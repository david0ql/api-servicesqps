import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ReviewItemsGroupedByClassDto } from './dto/review-items-with-class.dto';
import { CreateServiceReviewDto } from './dto/create-service-review.dto';
import { ReviewsService } from './reviews.service';

@ApiBearerAuth()
@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('/items-with-classes')
  @UseGuards(AuthGuard('jwt'))
  async getReviewItemsWithClasses(): Promise<ReviewItemsGroupedByClassDto[]> {
    return this.reviewsService.getReviewItemsWithClasses();
  }

  @Post('/service-review')
  @UseGuards(AuthGuard('jwt'))
  async createServiceReview(@Body() createServiceReviewDto: CreateServiceReviewDto) {
    return this.reviewsService.createServiceReview(createServiceReviewDto);
  }
} 