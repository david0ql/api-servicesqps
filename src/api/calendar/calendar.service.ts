import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import moment from 'moment-timezone';

import { ServicesEntity } from '../../entities/services.entity';
import { ReviewsByServiceEntity } from '../../entities/reviews_by_service.entity';
import { RecurringServicesEntity } from '../../entities/recurring_services.entity';
import { UsersEntity } from '../../entities/users.entity';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
    @InjectRepository(ReviewsByServiceEntity)
    private readonly reviewsByServiceRepository: Repository<ReviewsByServiceEntity>,
    @InjectRepository(RecurringServicesEntity)
    private readonly recurringServicesRepository: Repository<RecurringServicesEntity>,
  ) {}

  async findOne(type: string, currentUser?: UsersEntity) {
    const range = this.getDateRangeByType(type);
    if (!range) {
      return [];
    }

    return this.findByDateRange(range.startDate, range.endDate, currentUser);
  }

  async findByYearAndMonth(year: number, month: number, currentUser?: UsersEntity) {
    // month is 1-based (1 = January, 12 = December)
    const startDate = moment().year(year).month(month - 1).startOf('month').format('YYYY-MM-DD');
    const endDate = moment().year(year).month(month - 1).endOf('month').format('YYYY-MM-DD');

    return this.findByDateRange(startDate, endDate, currentUser);
  }

  private getDateRangeByType(type: string): { startDate: string; endDate: string } | null {
    const today = moment().format('YYYY-MM-DD');

    if (type === 'day') {
      return { startDate: today, endDate: today };
    }
    if (type === 'week') {
      return {
        startDate: moment().startOf('isoWeek').format('YYYY-MM-DD'),
        endDate: moment().endOf('isoWeek').format('YYYY-MM-DD'),
      };
    }
    if (type === 'month') {
      return {
        startDate: moment().startOf('month').format('YYYY-MM-DD'),
        endDate: moment().endOf('month').format('YYYY-MM-DD'),
      };
    }
    if (type === 'year') {
      return {
        startDate: moment().startOf('year').format('YYYY-MM-DD'),
        endDate: moment().endOf('year').format('YYYY-MM-DD'),
      };
    }
    return null;
  }

  private async findByDateRange(startDate: string, endDate: string, currentUser?: UsersEntity) {
    const services = await this.servicesRepository
      .createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoin('recurring_services', 'recurring', 'recurring.id = services.recurring_service_id')
      .where('services.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('(services.recurringServiceId IS NULL OR recurring.is_active = 1)')
      .getMany();

    const roleFilteredServices = await this.applyRoleVisibility(services, currentUser);
    return this.attachReviews(roleFilteredServices);
  }

  private async applyRoleVisibility(services: ServicesEntity[], currentUser?: UsersEntity): Promise<ServicesEntity[]> {
    if (!currentUser || currentUser.roleId !== '4') {
      return services;
    }

    const cleanerRecurringIds = [...new Set(
      services
        .filter((service) => service.userId === currentUser.id && Boolean(service.recurringServiceId))
        .map((service) => service.recurringServiceId as string),
    )];

    if (!cleanerRecurringIds.length) {
      return services;
    }

    const recurrings = await this.recurringServicesRepository.find({
      where: { id: In(cleanerRecurringIds) },
      select: ['id', 'qaHiddenDays'],
    });

    const hiddenDaysByRecurring = new Map<string, string[]>();
    recurrings.forEach((recurring) => {
      if (recurring.qaHiddenDays?.length) {
        hiddenDaysByRecurring.set(
          recurring.id,
          recurring.qaHiddenDays.map((day) => day.toLowerCase().trim()),
        );
      }
    });

    if (!hiddenDaysByRecurring.size) {
      return services;
    }

    return services.filter((service) => {
      if (service.userId !== currentUser.id) {
        return true;
      }
      if (!service.recurringServiceId) {
        return true;
      }
      const hiddenDays = hiddenDaysByRecurring.get(service.recurringServiceId);
      if (!hiddenDays?.length) {
        return true;
      }

      const serviceDay = moment.utc(service.date).format('ddd').toLowerCase();
      return !hiddenDays.includes(serviceDay);
    });
  }

  private async attachReviews(services: ServicesEntity[]) {
    return Promise.all(
      services.map(async (service) => {
        const reviews = await this.reviewsByServiceRepository
          .createQueryBuilder('reviewsByService')
          .leftJoinAndSelect('reviewsByService.reviewItem', 'reviewItem')
          .leftJoinAndSelect('reviewItem.reviewClass', 'reviewClass')
          .where('reviewsByService.serviceId = :serviceId', { serviceId: service.id })
          .getMany();

        const reviewsData = reviews.map((review) => ({
          value: review.value,
          reviewItemId: review.reviewItemId,
          reviewItemName: review.reviewItem?.name || '',
          reviewClassId: review.reviewItem?.reviewClassId || '',
          reviewClassName: review.reviewItem?.reviewClass?.name || '',
        }));

        if (service.user) {
          delete service.user.password;
        }

        return {
          ...service,
          reviews: reviewsData,
        };
      }),
    );
  }
}
