import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository, Between } from 'typeorm';
import moment from 'moment';
import { ServicesEntity } from '../../entities/services.entity';
import { ReviewsByServiceEntity } from '../../entities/reviews_by_service.entity';
import { ReviewItemsEntity } from '../../entities/review_items.entity';
import { ReviewClassesEntity } from '../../entities/review_classes.entity';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
    @InjectRepository(ReviewsByServiceEntity)
    private readonly reviewsByServiceRepository: Repository<ReviewsByServiceEntity>,
  ) {}

  async findOne(id: string) {
    const date = moment().format('YYYY-MM-DD');

    let whereCondition;

    if (id === 'day') {
      whereCondition = { date };
    } else if (id === 'week') {
      whereCondition = {
        date: Between(
          moment().startOf('isoWeek').format('YYYY-MM-DD'),
          moment().endOf('isoWeek').format('YYYY-MM-DD')
        ),
      };
    } else if (id === 'month') {
      whereCondition = {
        date: Between(
          moment().startOf('month').format('YYYY-MM-DD'),
          moment().endOf('month').format('YYYY-MM-DD')
        ),
      };
    } else if (id === 'year') {
      whereCondition = {
        date: Between(
          moment().startOf('year').format('YYYY-MM-DD'),
          moment().endOf('year').format('YYYY-MM-DD')
        ),
      };
    } else {
      return [];
    }

    const services = await this.servicesRepository.find({
      where: whereCondition,
      relations: ['community', 'type', 'status', 'user'],
    });

    // Get reviews for all services
    const servicesWithReviews = await Promise.all(
      services.map(async (service) => {
        const reviews = await this.reviewsByServiceRepository
          .createQueryBuilder('reviewsByService')
          .leftJoinAndSelect('reviewsByService.reviewItem', 'reviewItem')
          .leftJoinAndSelect('reviewItem.reviewClass', 'reviewClass')
          .where('reviewsByService.serviceId = :serviceId', { serviceId: service.id })
          .getMany();

        const reviewsData = reviews.map(review => ({
          value: review.value,
          reviewItemId: review.reviewItemId,
          reviewItemName: review.reviewItem?.name || '',
          reviewClassId: review.reviewItem?.reviewClassId || '',
          reviewClassName: review.reviewItem?.reviewClass?.name || ''
        }));

        if (service.user) {
          delete service.user.password;
        }

        return {
          ...service,
          reviews: reviewsData
        };
      })
    );

    return servicesWithReviews;
  }

  async findByYearAndMonth(year: number, month: number) {
    // month is 1-based (1 = January, 12 = December)
    const startDate = moment().year(year).month(month - 1).startOf('month').format('YYYY-MM-DD');
    const endDate = moment().year(year).month(month - 1).endOf('month').format('YYYY-MM-DD');

    const whereCondition = {
      date: Between(startDate, endDate),
    };

    const services = await this.servicesRepository.find({
      where: whereCondition,
      relations: ['community', 'type', 'status', 'user'],
    });

    // Get reviews for all services
    const servicesWithReviews = await Promise.all(
      services.map(async (service) => {
        const reviews = await this.reviewsByServiceRepository
          .createQueryBuilder('reviewsByService')
          .leftJoinAndSelect('reviewsByService.reviewItem', 'reviewItem')
          .leftJoinAndSelect('reviewItem.reviewClass', 'reviewClass')
          .where('reviewsByService.serviceId = :serviceId', { serviceId: service.id })
          .getMany();

        const reviewsData = reviews.map(review => ({
          value: review.value,
          reviewItemId: review.reviewItemId,
          reviewItemName: review.reviewItem?.name || '',
          reviewClassId: review.reviewItem?.reviewClassId || '',
          reviewClassName: review.reviewItem?.reviewClass?.name || ''
        }));

        if (service.user) {
          delete service.user.password;
        }

        return {
          ...service,
          reviews: reviewsData
        };
      })
    );

    return servicesWithReviews;
  }
}
