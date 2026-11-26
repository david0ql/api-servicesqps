import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { readFile, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import convert from 'heic-convert';

import { SkipApproval } from '../../decorators/skip-approval.decorator';
import {
  isAllowedImageUpload,
  isHeicUpload,
  MAX_REFRESH_PHOTO_SIZE,
  REFRESH_PHOTOS_DIR,
  REFRESH_PHOTOS_PUBLIC_PREFIX,
} from './refresh-photos.util';

import { ReviewItemsGroupedByClassDto } from './dto/review-items-with-class.dto';
import { CreateServiceReviewDto } from './dto/create-service-review.dto';
import { ReviewsService } from './reviews.service';
import { TrackServiceLocationDto } from '../services/dto/track-service-location.dto';

@ApiBearerAuth()
@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  private readonly logger = new Logger(ReviewsController.name);

  constructor(private readonly reviewsService: ReviewsService) {}

  // Subir la foto no cambia el servicio (eso lo hace service-review) y es
  // multipart (no se puede re-ejecutar): sin aprobacion.
  @Post('/photos/upload')
  @SkipApproval()
  @UseGuards(AuthGuard('jwt'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          mkdirSync(REFRESH_PHOTOS_DIR, { recursive: true });
          cb(null, REFRESH_PHOTOS_DIR);
        },
        filename: (req, file, cb) => {
          const ext = (extname(file.originalname || '') || '.jpg').toLowerCase().replace(/[^a-z0-9.]/g, '');
          cb(null, `${Date.now()}-${randomUUID()}${ext || '.jpg'}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!isAllowedImageUpload(file)) {
          return cb(new BadRequestException(`Invalid file type. Allowed: image/*. Received: ${file.mimetype}`), false);
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_REFRESH_PHOTO_SIZE },
    }),
  )
  async uploadRefreshPhoto(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }

    let filename = file.filename;

    if (isHeicUpload(file)) {
      try {
        const jpegBuffer = await convert({
          buffer: await readFile(file.path),
          format: 'JPEG',
          quality: 0.85,
        });
        filename = file.filename.replace(/\.hei[cf]$/i, '.jpg');
        if (filename === file.filename) filename = `${file.filename}.jpg`;
        await writeFile(join(file.destination, filename), jpegBuffer);
        await unlink(file.path);
      } catch (error) {
        await unlink(file.path).catch(() => undefined);
        this.logger.error('HEIC conversion failed for refresh photo', error);
        throw new BadRequestException('The HEIC image could not be processed.');
      }
    }

    const photoPath = `${REFRESH_PHOTOS_PUBLIC_PREFIX}${filename}`;
    return { photoPath, url: this.reviewsService.buildPhotoUrl(photoPath) };
  }

  @Get('/service/:serviceId/refresh-photos')
  @UseGuards(AuthGuard('jwt'))
  async getRefreshPhotos(@Param('serviceId') serviceId: string, @Req() req: any) {
    return this.reviewsService.getRefreshPhotos(serviceId, req.user.user);
  }

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
  async getQADailyTracking() {
    return this.reviewsService.getQADailyTracking();
  }
} 