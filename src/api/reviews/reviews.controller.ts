import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ReviewItemsWithClassDto } from './dto/review-items-with-class.dto';
import { ReviewsService } from './reviews.service';

@ApiBearerAuth()
@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('/items-with-classes')
  @UseGuards(AuthGuard('jwt'))
  async getReviewItemsWithClasses(): Promise<ReviewItemsWithClassDto[]> {
    return this.reviewsService.getReviewItemsWithClasses();
  }
} 