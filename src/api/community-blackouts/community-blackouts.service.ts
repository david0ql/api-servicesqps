import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import moment from 'moment-timezone';

import { CommunityBlackoutsEntity } from '../../entities/community_blackouts.entity';
import { CommunitiesEntity } from '../../entities/communities.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { UsersEntity } from '../../entities/users.entity';
import { CreateCommunityBlackoutDto } from './dto/create-community-blackout.dto';
import { FindCommunityBlackoutsDto } from './dto/find-community-blackouts.dto';
import {
  buildBlockedMessage,
  findBlockingBlackout,
  normalizeDate,
  parseTimeToMinutes,
} from './community-blackouts.rules';

/** Un bloqueo no puede durar mas de un ano: evita rangos por error de tipeo. */
export const MAX_BLACKOUT_DAYS = 366;

export interface ServiceSlot {
  communityId?: string | null;
  date?: string | null;
  schedule?: string | null;
}

export interface BlockedResult {
  blackout: CommunityBlackoutsEntity;
  message: string;
}

@Injectable()
export class CommunityBlackoutsService {
  constructor(
    @InjectRepository(CommunityBlackoutsEntity)
    private readonly blackoutsRepository: Repository<CommunityBlackoutsEntity>,
    @InjectRepository(CommunitiesEntity)
    private readonly communitiesRepository: Repository<CommunitiesEntity>,
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
  ) { }

  async create(dto: CreateCommunityBlackoutDto, currentUser?: UsersEntity) {
    const startDate = normalizeDate(dto.startDate);
    const endDate = normalizeDate(dto.endDate) ?? startDate;
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate debe tener formato YYYY-MM-DD.');
    }
    if (endDate < startDate) {
      throw new BadRequestException('La fecha final debe ser igual o posterior a la inicial.');
    }
    const days = moment(endDate, 'YYYY-MM-DD').diff(moment(startDate, 'YYYY-MM-DD'), 'days') + 1;
    if (days > MAX_BLACKOUT_DAYS) {
      throw new BadRequestException(`Un bloqueo no puede durar mas de ${MAX_BLACKOUT_DAYS} dias.`);
    }

    let startTime: string | null = null;
    let endTime: string | null = null;
    if (dto.period === 'custom') {
      const start = parseTimeToMinutes(dto.startTime);
      const end = parseTimeToMinutes(dto.endTime);
      if (start === null || end === null) {
        throw new BadRequestException('Para un rango personalizado indique hora de inicio y fin.');
      }
      if (end <= start) {
        throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio.');
      }
      startTime = this.toTimeColumn(dto.startTime);
      endTime = this.toTimeColumn(dto.endTime);
    }

    const communities = await this.resolveCommunities(dto);
    const reason = dto.reason?.trim() || null;

    const blackouts = communities.map((community) => this.blackoutsRepository.create({
      communityId: community.id,
      startDate,
      endDate,
      period: dto.period,
      startTime,
      endTime,
      reason,
      createdByUserId: currentUser?.id ?? null,
    }));

    await this.blackoutsRepository.save(blackouts);

    const conflictingServices = await this.findConflictingServices(blackouts);

    return { blackouts, conflictingServices };
  }

  async find(filter: FindCommunityBlackoutsDto = {}) {
    const where: any = {};
    if (filter.communityId) where.communityId = filter.communityId;
    const startDate = normalizeDate(filter.startDate);
    const endDate = normalizeDate(filter.endDate);
    // Solapamiento con [startDate, endDate]: termina despues del inicio y empieza antes del fin.
    if (startDate) where.endDate = MoreThanOrEqual(startDate);
    if (endDate) where.startDate = LessThanOrEqual(endDate);

    return this.blackoutsRepository.find({
      where,
      relations: ['community'],
      order: { startDate: 'ASC', id: 'ASC' },
    });
  }

  async remove(id: string) {
    const blackout = await this.blackoutsRepository.findOne({ where: { id } });
    if (!blackout) {
      throw new NotFoundException(`Bloqueo ${id} no encontrado`);
    }
    await this.blackoutsRepository.delete({ id });
    return blackout;
  }

  /** Bloqueo que impide el servicio, con el mensaje listo para mostrar; null si se permite. */
  async findBlocking(slot: ServiceSlot): Promise<BlockedResult | null> {
    const date = normalizeDate(slot.date);
    if (!slot.communityId || !date) return null;

    const blackouts = await this.blackoutsRepository.find({
      where: {
        communityId: slot.communityId,
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
      order: { id: 'ASC' },
    });

    const blackout = findBlockingBlackout(blackouts, date, slot.schedule);
    if (!blackout) return null;

    const community = await this.communitiesRepository.findOne({
      where: { id: slot.communityId },
      select: ['id', 'communityName'],
    });

    return { blackout, message: buildBlockedMessage(community?.communityName, date, blackout) };
  }

  /** Lanza 400 si el servicio cae en un horario fuera de servicio. */
  async assertServiceAllowed(slot: ServiceSlot): Promise<void> {
    const blocked = await this.findBlocking(slot);
    if (blocked) {
      throw new BadRequestException(blocked.message);
    }
  }

  /**
   * Para PATCH de servicios: solo valida si el cambio mueve el servicio
   * (fecha, hora o comunidad). Asi un servicio que ya existia en un dia que
   * despues se bloqueo puede seguir cambiando de estado, asignarse, etc.
   */
  async assertServiceUpdateAllowed(serviceId: string, changes: ServiceSlot): Promise<void> {
    const touches = ['communityId', 'date', 'schedule'].some((key) => changes[key] !== undefined);
    if (!touches) return;

    const existing = await this.servicesRepository.findOne({
      where: { id: serviceId },
      select: ['id', 'communityId', 'date', 'schedule'],
    });
    if (!existing) return; // el update se encarga del 404

    const next: ServiceSlot = {
      communityId: changes.communityId !== undefined ? changes.communityId : existing.communityId,
      date: changes.date !== undefined ? changes.date : existing.date,
      schedule: changes.schedule !== undefined ? changes.schedule : existing.schedule,
    };

    const moved = String(next.communityId ?? '') !== String(existing.communityId ?? '')
      || normalizeDate(next.date) !== normalizeDate(existing.date)
      || (parseTimeToMinutes(next.schedule) ?? 0) !== (parseTimeToMinutes(existing.schedule) ?? 0);
    if (!moved) return;

    await this.assertServiceAllowed(next);
  }

  private async resolveCommunities(dto: CreateCommunityBlackoutDto): Promise<CommunitiesEntity[]> {
    if (dto.allCommunities) {
      const all = await this.communitiesRepository.find({
        where: { isActive: true },
        select: ['id', 'communityName'],
      });
      if (!all.length) throw new BadRequestException('No hay comunidades activas.');
      return all;
    }

    const ids = Array.from(new Set([
      ...(dto.communityIds ?? []),
      ...(dto.communityId ? [dto.communityId] : []),
    ].map((id) => String(id).trim()).filter(Boolean)));

    if (!ids.length) {
      throw new BadRequestException('Indique al menos una comunidad.');
    }

    const found = await this.communitiesRepository.find({
      where: { id: In(ids) },
      select: ['id', 'communityName'],
    });
    const missing = ids.filter((id) => !found.some((c) => String(c.id) === id));
    if (missing.length) {
      throw new BadRequestException(`Comunidad no encontrada: ${missing.join(', ')}`);
    }
    return found;
  }

  /** Servicios ya creados que quedan dentro de los bloqueos nuevos (aviso, no se borran). */
  private async findConflictingServices(blackouts: CommunityBlackoutsEntity[]) {
    if (!blackouts.length) return [];
    const { startDate, endDate } = blackouts[0];
    const services = await this.servicesRepository.find({
      where: {
        communityId: In(blackouts.map((b) => b.communityId)),
        date: Between(startDate, endDate),
      },
      select: ['id', 'communityId', 'date', 'schedule', 'unitNumber', 'statusId'],
      order: { date: 'ASC' },
    });

    return services.filter((service) => {
      const own = blackouts.filter((b) => String(b.communityId) === String(service.communityId));
      return findBlockingBlackout(own, normalizeDate(service.date) ?? service.date, service.schedule) !== null;
    });
  }

  /** 'HH:mm' -> 'HH:mm:ss' para la columna TIME. */
  private toTimeColumn(value?: string): string | null {
    if (!value) return null;
    return value.length === 5 ? `${value}:00` : value;
  }
}
