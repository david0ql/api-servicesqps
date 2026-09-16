import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { ServiceStatusId } from '../../constants/service-status.enum';
import { ServicesEntity } from '../../entities/services.entity';
import { ServiceNotifierService } from './service-notifier.service';

const MINUTE_MS = 60_000;
const EXPIRATION_MINUTES = 180;

@Injectable()
export class ServiceAssignmentReminderService {
  private readonly logger = new Logger(ServiceAssignmentReminderService.name);
  private running = false;

  constructor(
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
    private readonly notifier: ServiceNotifierService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'service-assignment-reminders',
    timeZone: 'America/New_York',
  })
  async processPendingAssignments() {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const cutoff = new Date(Date.now() - 30 * MINUTE_MS);
      const services = await this.servicesRepository.find({
        where: {
          statusId: ServiceStatusId.Pending,
          assignedAt: LessThanOrEqual(cutoff),
        },
        relations: ['community', 'user'],
      });

      for (const service of services) {
        try {
          await this.processService(service);
        } catch (error) {
          this.logger.error(`Error procesando recordatorios del servicio ${service.id}`, error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async processService(service: ServicesEntity) {
    if (!service.assignedAt || !service.userId) {
      return;
    }

    const elapsedMinutes = (Date.now() - new Date(service.assignedAt).getTime()) / MINUTE_MS;
    if (elapsedMinutes >= EXPIRATION_MINUTES) {
      const result = await this.servicesRepository.createQueryBuilder()
        .update(ServicesEntity)
        .set({
          statusId: ServiceStatusId.Created,
          userId: null,
          assignmentReminderStage: 3,
          assignmentExpiredAt: new Date(),
        })
        .where('id = :id', { id: service.id })
        .andWhere('status_id = :statusId', { statusId: ServiceStatusId.Pending })
        .andWhere('user_id = :userId', { userId: service.userId })
        .execute();

      if (result.affected) {
        await this.notifier.notificarAsignacionVencida(service);
      }
      return;
    }

    const stage = elapsedMinutes >= 150 ? 3 : elapsedMinutes >= 90 ? 2 : 1;
    if ((service.assignmentReminderStage ?? 0) >= stage) {
      return;
    }

    const result = await this.servicesRepository.createQueryBuilder()
      .update(ServicesEntity)
      .set({ assignmentReminderStage: stage })
      .where('id = :id', { id: service.id })
      .andWhere('status_id = :statusId', { statusId: ServiceStatusId.Pending })
      .andWhere('user_id = :userId', { userId: service.userId })
      .andWhere('assignment_reminder_stage < :stage', { stage })
      .execute();

    if (result.affected) {
      await this.notifier.notificarRecordatorioAsignacion(service, stage);
    }
  }
}
