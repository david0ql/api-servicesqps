import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import moment from 'moment-timezone';

import { ReviewItemsEntity } from '../../entities/review_items.entity';
import { ReviewsByServiceEntity } from '../../entities/reviews_by_service.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { UsersEntity } from '../../entities/users.entity';
import { ReviewItemsGroupedByClassDto } from './dto/review-items-with-class.dto';
import { CreateServiceReviewDto } from './dto/create-service-review.dto';
import { TrackServiceLocationDto } from '../services/dto/track-service-location.dto';
import { PushNotificationsService } from '../../push-notification/push-notification.service';
import { ServiceNotifierService } from '../services/service-notifier.service';
import { buildRefreshResetUpdate, shouldResetForRefresh } from '../services/service-refresh.util';
import { ServiceRefreshPhotosEntity } from '../../entities/service_refresh_photos.entity';
import envVars from '../../config/env';
import {
  buildRefreshPhotoUrl,
  canViewRefreshPhotos,
  groupRefreshPhotosByRound,
  isValidRefreshPhotoPath,
  normalizeRefreshPhotos,
  RefreshPhotosRound,
} from './refresh-photos.util';

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
    private readonly notifier: ServiceNotifierService,
    @InjectRepository(ServiceRefreshPhotosEntity)
    private readonly refreshPhotosRepository: Repository<ServiceRefreshPhotosEntity>,
  ) {}

  /** URL publica (absoluta si REPORTS_PUBLIC_BASE_URL esta configurada). */
  buildPhotoUrl(photoPath: string): string {
    return buildRefreshPhotoUrl(photoPath, envVars?.REPORTS_PUBLIC_BASE_URL);
  }

  async getRefreshPhotos(serviceId: string, currentUser: UsersEntity): Promise<{ rounds: RefreshPhotosRound[] }> {
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId },
      select: ['id', 'userId'],
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    if (!canViewRefreshPhotos(currentUser, service)) {
      throw new ForbiddenException('You are not allowed to view the refresh photos of this service.');
    }

    const rows = await this.refreshPhotosRepository.find({
      where: { serviceId },
      order: { round: 'DESC', id: 'ASC' },
    });

    const userIds = Array.from(new Set(rows.map(row => row.createdByUserId).filter((id): id is string => !!id)));
    const users = userIds.length
      ? await this.usersRepository.find({ where: { id: In(userIds) }, select: ['id', 'name'] })
      : [];
    const usersById = new Map(users.map(user => [String(user.id), { id: String(user.id), name: user.name }]));

    return { rounds: groupRefreshPhotosByRound(rows, usersById, envVars?.REPORTS_PUBLIC_BASE_URL) };
  }

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

    // Skip only if QA already started today (same calendar day in Eastern time)
    if (service.qaStartedAt) {
      const startedDay = moment.tz(service.qaStartedAt, 'America/New_York').format('YYYY-MM-DD');
      const today = moment.tz('America/New_York').format('YYYY-MM-DD');
      if (startedDay === today) {
        return { success: true, skipped: true };
      }
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

    const refreshPhotos = normalizeRefreshPhotos(createServiceReviewDto.refreshPhotos);
    const invalidPhoto = refreshPhotos.find(photo => !isValidRefreshPhotoPath(photo));
    if (invalidPhoto) {
      throw new BadRequestException(`Invalid refresh photo path: ${invalidPhoto}`);
    }

    // Checklist viejo (opcional). Clientes nuevos mandan solo refreshPhotos.
    const savedReviews = [];

    for (const item of createServiceReviewDto.reviewItems ?? []) {
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

    // Ojo: en el checklist viejo value=1 (switch prendido) significa item
    // fallido. Con fotos el refresh lo deciden las fotos.
    const hasRefreshPhotos = refreshPhotos.length > 0;
    const hasFailedItems = hasRefreshPhotos || savedReviews.some(review => review.value !== 0);

    // Build service update with QA finish location if provided
    const serviceUpdate: Partial<ServicesEntity> = {
      statusId: hasFailedItems ? '3' : '6',
      qaFlagged: false,
      refreshPhotosCount: refreshPhotos.length,
    };

    if (hasRefreshPhotos) {
      const last = await this.refreshPhotosRepository.findOne({
        where: { serviceId: createServiceReviewDto.serviceId },
        order: { round: 'DESC' },
        select: ['id', 'round'],
      });
      const round = (Number(last?.round) || 0) + 1;
      const message = createServiceReviewDto.message?.trim() || null;
      await this.refreshPhotosRepository.save(
        refreshPhotos.map(photoPath => this.refreshPhotosRepository.create({
          serviceId: createServiceReviewDto.serviceId,
          round,
          photoPath,
          createdByUserId: currentUser?.id ?? null,
          message,
        })),
      );
    }

    // Refresh: se guarda el intento anterior y se limpian inicio/fin para que
    // la cleaner pueda volver a iniciar y finalizar el servicio.
    if (hasFailedItems && shouldResetForRefresh(service)) {
      Object.assign(serviceUpdate, buildRefreshResetUpdate(service, new Date(), currentUser?.id ?? null));
    }

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

    // Antes solo se avisaba el refresh: cuando la QA terminaba y todo estaba
    // bien NO salia ningun mensaje. Ahora se avisan los dos casos.
    const servicioConRelaciones = await this.servicesRepository.findOne({
      where: { id: createServiceReviewDto.serviceId },
      relations: ['community', 'status', 'user', 'type'],
    });

    if (servicioConRelaciones) {
      await this.notifier.notificar(hasFailedItems ? 'refresh' : 'finalizado', servicioConRelaciones);
    }

    return savedReviews;
  }

  async getQADailyTracking() {
    const today = moment.tz('America/New_York');
    const startOfDay = today.clone().startOf('day').toDate();
    const endOfDay = today.clone().endOf('day').toDate();

    const services = await this.servicesRepository
      .createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .where('services.qaStartedAt IS NOT NULL')
      .andWhere('services.qaStartedAt >= :startOfDay', { startOfDay })
      .andWhere('services.qaStartedAt <= :endOfDay', { endOfDay })
      .orderBy('services.qaStartedAt', 'ASC')
      .getMany();

    const finished = services.filter(s => s.qaFinishedAt !== null).length;

    return {
      date: today.format('YYYY-MM-DD'),
      summary: {
        totalReviewed: services.length,
        finished,
        notFinished: services.length - finished,
      },
      services,
    };
  }

}
