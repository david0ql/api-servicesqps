import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import moment from 'moment-timezone';

import { StatusPageOptionsDto } from '../../dto/status-page-options.dto';
import { PageMetaDto } from 'src/dto/page-meta.dto';
import { PageDto } from 'src/dto/page.dto';
import { SearchDto } from 'src/dto/search.dto';

import { RecurringServicesEntity } from 'src/entities/recurring_services.entity';
import { ServicesEntity } from 'src/entities/services.entity';
import { UsersEntity } from 'src/entities/users.entity';
import { CreateRecurringServiceDto } from './dto/create-recurring-service.dto';
import { UpdateRecurringServiceDto } from './dto/update-recurring-service.dto';
import { ServicesService } from '../services/services.service';
import { CommunityBlackoutsService } from '../community-blackouts/community-blackouts.service';
import { isAdminLike } from 'src/constants/roles';

const ALLOWED_DAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const DAY_TO_ISO: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

@Injectable()
export class RecurringServicesService {
  private readonly logger = new Logger(RecurringServicesService.name);

  constructor(
    @InjectRepository(RecurringServicesEntity)
    private readonly recurringServicesRepository: Repository<RecurringServicesEntity>,
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    private readonly servicesService: ServicesService,
    private readonly blackouts: CommunityBlackoutsService,
  ) {}

  async create(createRecurringServiceDto: CreateRecurringServiceDto, currentUser?: UsersEntity) {
    const normalizedDays = this.normalizeDays(createRecurringServiceDto.daysOfWeek);
    if (!normalizedDays.length) {
      throw new BadRequestException('At least one day of week is required.');
    }

    if (createRecurringServiceDto.userId) {
      await this.assertAssignableUser(createRecurringServiceDto.userId);
    }

    const startDate = this.getNextWeekStart().format('YYYY-MM-DD');

    const recurringService = this.recurringServicesRepository.create({
      ...createRecurringServiceDto,
      daysOfWeek: normalizedDays,
      extraIds: createRecurringServiceDto.extraIds ?? [],
      isActive: createRecurringServiceDto.isActive ?? true,
      startDate,
      assignedByUserId: createRecurringServiceDto.userId && isAdminLike(currentUser?.roleId)
        ? currentUser.id
        : null,
    });

    await this.recurringServicesRepository.save(recurringService);

    return recurringService;
  }

  async searchByWord(searchDto: SearchDto, pageOptionsDto: StatusPageOptionsDto): Promise<PageDto<RecurringServicesEntity>> {
    const query = this.recurringServicesRepository
      .createQueryBuilder('recurring')
      .leftJoinAndSelect('recurring.community', 'community')
      .leftJoinAndSelect('recurring.type', 'type')
      .leftJoinAndSelect('recurring.status', 'status')
      .leftJoinAndSelect('recurring.user', 'user')
      .where('recurring.isActive = :isActive', { isActive: pageOptionsDto.status !== 'inactive' })
      .andWhere(new Brackets((qb) => {
        qb.where('community.communityName LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
          .orWhere('recurring.unitNumber LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
          .orWhere('recurring.schedule LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
          .orWhere('type.cleaningType LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
          .orWhere('type.description LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` });
      }))
      .orderBy('recurring.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take);

    const [items, totalCount] = await query.getManyAndCount();
    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: StatusPageOptionsDto): Promise<PageDto<RecurringServicesEntity>> {
    const query = this.recurringServicesRepository
      .createQueryBuilder('recurring')
      .leftJoinAndSelect('recurring.community', 'community')
      .leftJoinAndSelect('recurring.type', 'type')
      .leftJoinAndSelect('recurring.status', 'status')
      .leftJoinAndSelect('recurring.user', 'user')
      // Sin status (o active): solo activas, como antes. status=inactive: las pausadas.
      .where('recurring.isActive = :isActive', { isActive: pageOptionsDto.status !== 'inactive' })
      .orderBy('recurring.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take);

    const [items, totalCount] = await query.getManyAndCount();
    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const recurringService = await this.recurringServicesRepository.findOne({
      where: { id },
      relations: ['community', 'type', 'status', 'user'],
    });

    if (!recurringService) {
      throw new NotFoundException(`Recurring service with ID ${id} not found`);
    }

    return recurringService;
  }

  async update(id: string, updateRecurringServiceDto: UpdateRecurringServiceDto, currentUser?: UsersEntity) {
    if (updateRecurringServiceDto.userId) {
      await this.assertAssignableUser(updateRecurringServiceDto.userId);
    }

    const normalizedDays = updateRecurringServiceDto.daysOfWeek
      ? this.normalizeDays(updateRecurringServiceDto.daysOfWeek)
      : undefined;

    if (updateRecurringServiceDto.daysOfWeek && !normalizedDays?.length) {
      throw new BadRequestException('At least one day of week is required.');
    }

    const recurringService = await this.recurringServicesRepository.preload({
      id,
      ...updateRecurringServiceDto,
      ...(normalizedDays ? { daysOfWeek: normalizedDays } : {}),
      ...(updateRecurringServiceDto.extraIds ? { extraIds: updateRecurringServiceDto.extraIds } : {}),
      ...(typeof updateRecurringServiceDto.userId !== 'undefined'
        ? {
            assignedByUserId: updateRecurringServiceDto.userId && isAdminLike(currentUser?.roleId)
              ? currentUser.id
              : null,
          }
        : {}),
    });

    if (!recurringService) {
      throw new NotFoundException(`Recurring service with ID ${id} not found`);
    }

    await this.recurringServicesRepository.save(recurringService);

    return recurringService;
  }

  async remove(id: string) {
    const recurringService = await this.recurringServicesRepository.findOne({
      where: { id },
    });

    if (!recurringService) {
      throw new NotFoundException(`Recurring service with ID ${id} not found`);
    }

    return this.recurringServicesRepository.remove(recurringService);
  }

  @Cron('0 18 * * 0', { name: 'recurring-services-weekly', timeZone: 'America/New_York' })
  async generateWeeklyServices() {
    const { weekStart, weekEnd } = this.getGenerationWindow();

    const recurringServices = await this.recurringServicesRepository.find({
      where: { isActive: true },
    });

    if (!recurringServices.length) {
      return;
    }

    for (const recurring of recurringServices) {
      if (!recurring.startDate) {
        continue;
      }

      if (!recurring.communityId || !recurring.typeId || !recurring.statusId) {
        this.logger.warn(`Recurring service ${recurring.id} is missing required relations.`);
        continue;
      }

      const startDate = moment(recurring.startDate, 'YYYY-MM-DD', true);
      if (!startDate.isValid() || startDate.isAfter(weekEnd, 'day')) {
        continue;
      }

      for (const day of recurring.daysOfWeek || []) {
        const isoDay = DAY_TO_ISO[day];
        if (!isoDay) {
          continue;
        }

        const serviceDate = moment(weekStart).isoWeekday(isoDay);
        if (serviceDate.isBefore(startDate, 'day')) {
          continue;
        }

        const formattedDate = serviceDate.format('YYYY-MM-DD');
        const existing = await this.servicesRepository.findOne({
          where: { recurringServiceId: recurring.id, date: formattedDate },
        });

        if (existing) {
          continue;
        }

        // Festividades / fuera de servicio: se salta solo ese dia, el resto sigue.
        const blocked = await this.blackouts.findBlocking({
          communityId: recurring.communityId,
          date: formattedDate,
          schedule: recurring.schedule,
        });
        if (blocked) {
          this.logger.log(`Recurring service ${recurring.id}: skipped ${formattedDate}. ${blocked.message}`);
          continue;
        }

        const payload = {
          date: formattedDate,
          schedule: recurring.schedule,
          comment: recurring.comment,
          userComment: recurring.userComment,
          communityId: recurring.communityId,
          typeId: recurring.typeId,
          statusId: recurring.statusId,
          unitNumber: recurring.unitNumber,
          unitySize: recurring.unitySize,
          ...(recurring.userId ? { userId: recurring.userId } : {}),
          extraId: recurring.extraIds ?? [],
          recurringServiceId: recurring.id,
        } as any;

        try {
          await this.servicesService.create(payload, undefined, recurring.assignedByUserId);
        } catch (error) {
          this.logger.warn(`Failed to create recurring service ${recurring.id} for ${formattedDate}: ${(error as Error)?.message ?? error}`);
        }
      }
    }
  }

  private normalizeDays(days: string[]) {
    return Array.from(new Set(days
      .map((day) => day.toLowerCase().trim())
      .filter((day) => ALLOWED_DAYS.has(day))));
  }

  private getNextWeekStart() {
    return moment().startOf('isoWeek').add(1, 'week');
  }

  private getGenerationWindow(referenceDate = moment()) {
    const weekStart = moment(referenceDate).add(1, 'week').startOf('isoWeek');
    const weekEnd = moment(weekStart).endOf('isoWeek');
    return { weekStart, weekEnd };
  }

  private async assertAssignableUser(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'roleId'],
    });

    if (!user) {
      throw new BadRequestException('Assigned user not found.');
    }

    if (user.roleId !== '4' && user.roleId !== '7') {
      throw new BadRequestException('Assigned user must be a Cleaner or QA.');
    }
  }
}
