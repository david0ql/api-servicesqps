import { Controller, Get, Post, Body, UseGuards, Req, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ReviewItemsGroupedByClassDto } from './dto/review-items-with-class.dto';
import { CreateServiceReviewDto } from './dto/create-service-review.dto';
import { ReviewsService } from './reviews.service';
import { TrackServiceLocationDto } from '../services/dto/track-service-location.dto';

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

  @Post('/qa-start/:serviceId')
  @UseGuards(AuthGuard('jwt'))
  async trackQAStart(
    @Param('serviceId') serviceId: string,
    @Body() dto: TrackServiceLocationDto,
    @Req() req: any,
  ) {
    return this.reviewsService.trackQAStart(serviceId, dto, req.user.user);
  }

  @Post('/service-review')
  @UseGuards(AuthGuard('jwt'))
  async createServiceReview(@Body() createServiceReviewDto: CreateServiceReviewDto, @Req() req: any) {
    return this.reviewsService.createServiceReview(createServiceReviewDto, req.user.user);
  }

  @Get('/qa-tracking/daily')
  @UseGuards(AuthGuard('jwt'))
  async getQADailyTracking(@Query('date') date: string) {
    return this.reviewsService.getQADailyTracking(date);
  }
} 