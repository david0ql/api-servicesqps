import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ReviewItemsEntity } from '../../entities/review_items.entity';
import { ReviewItemsWithClassDto } from './dto/review-items-with-class.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewItemsEntity)
    private readonly reviewItemsRepository: Repository<ReviewItemsEntity>,
  ) {}

  async getReviewItemsWithClasses(): Promise<ReviewItemsWithClassDto[]> {
    const queryBuilder = this.reviewItemsRepository.createQueryBuilder('reviewItems')
      .innerJoinAndSelect('reviewItems.reviewClass', 'reviewClass')
      .orderBy('reviewClass.name', 'ASC')
      .addOrderBy('reviewItems.name', 'ASC');

    const items = await queryBuilder.getMany();

    return items.map(item => ({
      id: item.id,
      name: item.name,
      reviewClassId: item.reviewClassId,
      reviewClassName: item.reviewClass?.name || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }
} 