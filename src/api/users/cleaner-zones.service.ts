import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { UsersEntity } from '../../entities/users.entity';
import { CommunitiesEntity } from '../../entities/communities.entity';
import {
  CLEANER_ROLE_ID,
  CleanerWorkZone,
  hasWorkZone,
  InvalidWorkZoneError,
  isCleanerEligibleForCommunity,
  isZoneEnforced,
  normalizeEnforceFrom,
  normalizeIdList,
  normalizeWorkZones,
} from './cleaner-zone.util';

/** Token con la fecha (YYYY-MM-DD, Nueva York) desde la que se aplica la zona. */
export const CLEANER_ZONE_ENFORCE_FROM = 'CLEANER_ZONE_ENFORCE_FROM';

const QA_ROLE_ID = '7';

export interface CleanerZoneStatus {
  enforced: boolean;
  enforceFrom: string;
}

export interface UpdateWorkZoneInput {
  communityIds?: Array<string | number> | null;
  companyIds?: Array<string | number> | null;
  zones?: unknown;
}

/** El cleaner elegido no tiene la comunidad en su zona de trabajo. */
export class CleanerNotEligibleException extends BadRequestException {
  readonly code = 'CLEANER_NOT_ELIGIBLE';
}

const ZONE_SELECT: (keyof UsersEntity)[] = [
  'id', 'name', 'roleId', 'isActive', 'workCommunityIds', 'workCompanyIds', 'workZones', 'hasWorkZone',
];

@Injectable()
export class CleanerZonesService {
  constructor(
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    @InjectRepository(CommunitiesEntity)
    private readonly communitiesRepository: Repository<CommunitiesEntity>,
    @Inject(CLEANER_ZONE_ENFORCE_FROM)
    private readonly enforceFrom: string,
  ) {}

  getStatus(now: Date = new Date()): CleanerZoneStatus {
    const enforceFrom = normalizeEnforceFrom(this.enforceFrom);
    return { enforced: isZoneEnforced(now, enforceFrom), enforceFrom };
  }

  isEnforced(now: Date = new Date()): boolean {
    return this.getStatus(now).enforced;
  }

  async getWorkZone(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId }, select: ZONE_SELECT });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);
    return this.toWorkZoneResponse(user);
  }

  async updateWorkZone(userId: string, input: UpdateWorkZoneInput) {
    const user = await this.usersRepository.findOne({ where: { id: userId }, select: ZONE_SELECT });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    const patch: CleanerWorkZone = {
      workCommunityIds: user.workCommunityIds ?? [],
      workCompanyIds: user.workCompanyIds ?? [],
      workZones: user.workZones ?? null,
    };
    if (input.communityIds !== undefined) patch.workCommunityIds = normalizeIdList(input.communityIds);
    if (input.companyIds !== undefined) patch.workCompanyIds = normalizeIdList(input.companyIds);
    if (input.zones !== undefined) {
      try {
        patch.workZones = normalizeWorkZones(input.zones);
      } catch (error) {
        if (error instanceof InvalidWorkZoneError) throw new BadRequestException(error.message);
        throw error;
      }
    }

    await this.usersRepository.update(userId, {
      workCommunityIds: patch.workCommunityIds,
      workCompanyIds: patch.workCompanyIds,
      workZones: patch.workZones as any,
      hasWorkZone: hasWorkZone(patch),
    });

    return this.getWorkZone(userId);
  }

  /**
   * Cleaners (rol 4) y QA (rol 7) activos que se pueden asignar a la comunidad.
   * QA no tiene zona: siempre aparece. Durante el periodo de gracia salen todas.
   */
  async findEligibleAssignees(communityId: string, now: Date = new Date()) {
    const status = this.getStatus(now);
    const community = await this.communitiesRepository.findOne({
      where: { id: communityId },
      select: ['id', 'companyId', 'latitude', 'longitude'],
    });
    if (!community) throw new NotFoundException(`Community with ID ${communityId} not found`);

    const users = await this.usersRepository.find({
      where: { roleId: In([CLEANER_ROLE_ID, QA_ROLE_ID]), isActive: true },
      select: [...ZONE_SELECT, 'email', 'phoneNumber'],
      order: { name: 'ASC' },
    });

    const items = users
      .filter((user) => !status.enforced
        || String(user.roleId) !== CLEANER_ROLE_ID
        || isCleanerEligibleForCommunity(user, community))
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        roleId: user.roleId,
        isActive: user.isActive,
        hasWorkZone: user.hasWorkZone,
        eligible: String(user.roleId) !== CLEANER_ROLE_ID || isCleanerEligibleForCommunity(user, community),
      }));

    return { ...status, communityId: String(community.id), data: items };
  }

  /**
   * Valida una asignacion. No hace nada si no aplica (periodo de gracia, sin
   * comunidad, o el usuario no es cleaner). Lanza CleanerNotEligibleException (400).
   */
  async assertEligible(userId: string | null | undefined, communityId: string | null | undefined, now: Date = new Date()) {
    if (!userId || !communityId || !this.isEnforced(now)) return;
    const user = await this.usersRepository.findOne({ where: { id: userId }, select: ZONE_SELECT });
    if (!user || String(user.roleId) !== CLEANER_ROLE_ID) return;
    const community = await this.communitiesRepository.findOne({
      where: { id: communityId },
      select: ['id', 'communityName', 'companyId', 'latitude', 'longitude'],
    });
    if (!community) return;
    if (!isCleanerEligibleForCommunity(user, community)) {
      throw new CleanerNotEligibleException(
        `La cleaner ${user.name} no tiene la comunidad ${community.communityName} dentro de su zona de trabajo. `
        + 'Asigna otra cleaner o actualiza su zona en Users.',
      );
    }
  }

  private toWorkZoneResponse(user: UsersEntity) {
    return {
      userId: user.id,
      communityIds: (user.workCommunityIds ?? []).map(String),
      companyIds: (user.workCompanyIds ?? []).map(String),
      zones: user.workZones ?? { type: 'FeatureCollection', features: [] },
      hasWorkZone: Boolean(user.hasWorkZone),
      ...this.getStatus(),
    };
  }
}
