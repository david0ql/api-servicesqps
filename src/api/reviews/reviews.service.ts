import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ReviewItemsEntity } from '../../entities/review_items.entity';
import { ReviewsByServiceEntity } from '../../entities/reviews_by_service.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { UsersEntity } from '../../entities/users.entity';
import { ReviewItemsGroupedByClassDto, ReviewItemDto } from './dto/review-items-with-class.dto';
import { CreateServiceReviewDto } from './dto/create-service-review.dto';
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

  async createServiceReview(createServiceReviewDto: CreateServiceReviewDto) {
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
      // Check if review already exists
      const existingReview = await this.reviewsByServiceRepository.findOne({
        where: {
          serviceId: createServiceReviewDto.serviceId,
          reviewItemId: item.reviewItemId
        }
      });

      if (existingReview) {
        // Update existing review
        existingReview.value = item.value ? 1 : 0;
        const updatedReview = await this.reviewsByServiceRepository.save(existingReview);
        savedReviews.push(updatedReview);
      } else {
        // Create new review
        const newReview = this.reviewsByServiceRepository.create({
          serviceId: createServiceReviewDto.serviceId,
          reviewItemId: item.reviewItemId,
          value: item.value ? 1 : 0
        });
        const createdReview = await this.reviewsByServiceRepository.save(newReview);
        savedReviews.push(createdReview);
      }
    }

    const hasFailedItems = savedReviews.some(review => review.value !== 0);

    if (hasFailedItems) {
      await this.servicesRepository.update(createServiceReviewDto.serviceId, {
        statusId: '3',
        comment: createServiceReviewDto.message || 'Service needs refresh due to failed review items'
      });

      await this.notifyServiceRefresh(service);
    } else {
      await this.servicesRepository.update(createServiceReviewDto.serviceId, {
        statusId: '6',
        comment: createServiceReviewDto.message || 'Service approved'
      });
    }

    return savedReviews;
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