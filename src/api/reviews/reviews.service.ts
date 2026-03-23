import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import moment from 'moment-timezone';

import { ReviewItemsEntity } from '../../entities/review_items.entity';
import { ReviewsByServiceEntity } from '../../entities/reviews_by_service.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { UsersEntity } from '../../entities/users.entity';
import { ReviewItemsGroupedByClassDto } from './dto/review-items-with-class.dto';
import { CreateServiceReviewDto } from './dto/create-service-review.dto';
import { TrackServiceLocationDto } from '../services/dto/track-service-location.dto';
import { PushNotificationsService } from '../../push-notification/push-notification.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewItemsEntity)
    private readonly reviewItemsRepository: Repository<ReviewItemsEntity>,
    @InjectRepository(ReviewsByServiceEntity)
    private readonly reviewsByServiceRepository: Repository<ReviewsByServiceEntity>,
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  async getReviewItemsWithClasses(): Promise<ReviewItemsGroupedByClassDto[]> {
    const queryBuilder = this.reviewItemsRepository.createQueryBuilder('reviewItems')
      .innerJoinAndSelect('reviewItems.reviewClass', 'reviewClass')
      .orderBy('reviewClass.name', 'ASC')
      .addOrderBy('reviewItems.name', 'ASC');

    const items = await queryBuilder.getMany();

    // Group items by review class
    const groupedItems = items.reduce((acc, item) => {
      const className = item.reviewClass?.name || 'Unknown';
      const classId = item.reviewClassId;
      
      if (!acc[className]) {
        acc[className] = {
          reviewClassName: className,
          reviewClassId: classId,
          reviewItems: []
        };
      }
      
      acc[className].reviewItems.push({
        id: item.id,
        name: item.name
      });
      
      return acc;
    }, {} as Record<string, ReviewItemsGroupedByClassDto>);

    return Object.values(groupedItems);
  }

  async trackQAStart(serviceId: string, payload: TrackServiceLocationDto, currentUser: UsersEntity) {
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId },
      select: ['id', 'userId', 'statusId', 'qaStartedAt'],
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    if (currentUser.roleId !== '7') {
      throw new BadRequestException('Only QA users can track QA start location.');
    }

    if (service.qaStartedAt) {
      return { success: true, skipped: true };
    }

    await this.servicesRepository.update(serviceId, {
      qaUserId: currentUser.id,
      qaStartedAt: new Date(),
      qaStartLatitude: payload.latitude.toString(),
      qaStartLongitude: payload.longitude.toString(),
      qaStartAccuracy: payload.accuracy != null ? payload.accuracy.toString() : null,
      qaStartAltitude: payload.altitude != null ? payload.altitude.toString() : null,
      qaStartAltitudeAccuracy: payload.altitudeAccuracy != null ? payload.altitudeAccuracy.toString() : null,
      qaStartHeading: payload.heading != null ? payload.heading.toString() : null,
      qaStartSpeed: payload.speed != null ? payload.speed.toString() : null,
      qaStartLocationMeta: payload.capturedAt || payload.meta
        ? JSON.stringify({ capturedAt: payload.capturedAt, ...payload.meta })
        : null,
    });

    return { success: true };
  }

  async createServiceReview(createServiceReviewDto: CreateServiceReviewDto, currentUser?: UsersEntity) {
    const service = await this.servicesRepository.findOne({
      where: { id: createServiceReviewDto.serviceId },
      relations: ['community', 'user', 'status']
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${createServiceReviewDto.serviceId} not found`);
    }

    // Process each review item (insert or update)
    const savedReviews = [];

    for (const item of createServiceReviewDto.reviewItems) {
      const existingReview = await this.reviewsByServiceRepository.findOne({
        where: {
          serviceId: createServiceReviewDto.serviceId,
          reviewItemId: item.reviewItemId
        }
      });

      if (existingReview) {
        existingReview.value = item.value ? 1 : 0;
        savedReviews.push(await this.reviewsByServiceRepository.save(existingReview));
      } else {
        const newReview = this.reviewsByServiceRepository.create({
          serviceId: createServiceReviewDto.serviceId,
          reviewItemId: item.reviewItemId,
          value: item.value ? 1 : 0
        });
        savedReviews.push(await this.reviewsByServiceRepository.save(newReview));
      }
    }

    const hasFailedItems = savedReviews.some(review => review.value !== 0);

    // Build service update with QA finish location if provided
    const serviceUpdate: Partial<ServicesEntity> = {
      statusId: hasFailedItems ? '3' : '6',
      comment: createServiceReviewDto.message || (hasFailedItems ? 'Service needs refresh due to failed review items' : 'Service approved'),
    };

    if (createServiceReviewDto.latitude != null && createServiceReviewDto.longitude != null) {
      serviceUpdate.qaFinishedAt = new Date();
      serviceUpdate.qaFinishLatitude = createServiceReviewDto.latitude.toString();
      serviceUpdate.qaFinishLongitude = createServiceReviewDto.longitude.toString();
      serviceUpdate.qaFinishAccuracy = createServiceReviewDto.accuracy != null ? createServiceReviewDto.accuracy.toString() : null;
      serviceUpdate.qaFinishAltitude = createServiceReviewDto.altitude != null ? createServiceReviewDto.altitude.toString() : null;
      serviceUpdate.qaFinishAltitudeAccuracy = createServiceReviewDto.altitudeAccuracy != null ? createServiceReviewDto.altitudeAccuracy.toString() : null;
      serviceUpdate.qaFinishHeading = createServiceReviewDto.heading != null ? createServiceReviewDto.heading.toString() : null;
      serviceUpdate.qaFinishSpeed = createServiceReviewDto.speed != null ? createServiceReviewDto.speed.toString() : null;
      serviceUpdate.qaFinishLocationMeta = createServiceReviewDto.capturedAt || createServiceReviewDto.meta
        ? JSON.stringify({ capturedAt: createServiceReviewDto.capturedAt, ...createServiceReviewDto.meta })
        : null;
      if (currentUser) serviceUpdate.qaUserId = currentUser.id;
    }

    await this.servicesRepository.update(createServiceReviewDto.serviceId, serviceUpdate);

    if (hasFailedItems) {
      await this.notifyServiceRefresh(service);
    }

    return savedReviews;
  }

  async getQADailyTracking(date: string) {
    const targetDate = moment(date, 'YYYY-MM-DD', true);
    if (!targetDate.isValid()) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const services = await this.servicesRepository
      .createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .where('services.qaStartedAt IS NOT NULL')
      .andWhere('DATE(services.qaStartedAt) = :date', { date: targetDate.format('YYYY-MM-DD') })
      .orderBy('services.qaStartedAt', 'ASC')
      .getMany();

    const finished = services.filter(s => s.qaFinishedAt !== null).length;

    return {
      date: targetDate.format('YYYY-MM-DD'),
      summary: {
        totalReviewed: services.length,
        finished,
        notFinished: services.length - finished,
      },
      services,
    };
  }

  private async notifyServiceRefresh(service: ServicesEntity) {
    const superAdmins = await this.usersRepository.find({
      where: { roleId: '1' },
      select: ['id', 'token', 'phoneNumber', 'name', 'roleId'],
    });

    const qaUsers = await this.usersRepository.find({
      where: { roleId: '7' },
      select: ['id', 'token', 'phoneNumber', 'name', 'roleId'],
    });

    let serviceCleaner = null;
    if (service.user?.id) {
      serviceCleaner = await this.usersRepository.findOne({
        where: { id: service.user.id },
        select: ['id', 'token', 'phoneNumber', 'name', 'roleId'],
      });
    }

    const allUsers = [
      ...superAdmins,
      ...qaUsers,
      ...(serviceCleaner ? [serviceCleaner] : [])
    ].filter(Boolean);

    const usersWithToken = allUsers
      .filter(user => user?.token && user.token.trim() !== '')
      .filter((user, index, self) => 
        self.findIndex(u => u.token === user.token) === index
      );

    const usersWithPhone = allUsers
      .filter(user => user?.phoneNumber && user.phoneNumber.trim() !== '')
      .filter((user, index, self) => 
        self.findIndex(u => u.phoneNumber === user.phoneNumber) === index
      );

    const notification = {
      body: `Service in ${service.community?.communityName ?? 'Unknown Community'} needs refresh. Review items failed.`,
      title: 'Service Needs Refresh',
      data: {
        serviceId: service.id,
        serviceType: service.type,
        serviceDate: service.date,
        serviceStatus: service.status,
      },
      tokensNotification: {
        tokens: usersWithToken.map(user => user.token),
        users: usersWithPhone
      }
    };

    await this.pushNotificationsService.sendNotification(notification);
  }
} 