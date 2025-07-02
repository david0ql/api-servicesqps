import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ReviewItemsEntity } from '../../entities/review_items.entity';
import { ReviewsByServiceEntity } from '../../entities/reviews_by_service.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { ReviewItemsGroupedByClassDto, ReviewItemDto } from './dto/review-items-with-class.dto';
import { CreateServiceReviewDto } from './dto/create-service-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewItemsEntity)
    private readonly reviewItemsRepository: Repository<ReviewItemsEntity>,
    @InjectRepository(ReviewsByServiceEntity)
    private readonly reviewsByServiceRepository: Repository<ReviewsByServiceEntity>,
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
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
      where: { id: createServiceReviewDto.serviceId }
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${createServiceReviewDto.serviceId} not found`);
    }

    const reviewRecords = createServiceReviewDto.reviewItems.map(item => 
      this.reviewsByServiceRepository.create({
        serviceId: createServiceReviewDto.serviceId,
        reviewItemId: item.reviewItemId,
        value: item.value ? 1 : 0
      })
    );

    const savedReviews = await this.reviewsByServiceRepository.save(reviewRecords);

    return savedReviews;
  }
} 