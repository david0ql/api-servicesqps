import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import moment from 'moment';
import { promises as fs } from 'fs';
import { join } from 'path';

import { ServiceChatMessagesEntity } from '../../entities/service_chat_messages.entity';
import { ServicesEntity } from '../../entities/services.entity';

const CHAT_RETENTION_MONTHS = 3;

@Injectable()
export class ServiceChatCleanupService {
  private readonly logger = new Logger(ServiceChatCleanupService.name);

  constructor(
    @InjectRepository(ServiceChatMessagesEntity)
    private readonly chatMessagesRepository: Repository<ServiceChatMessagesEntity>,
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'service-chat-cleanup',
    timeZone: 'America/New_York',
  })
  async handleCleanup() {
    const cutoff = moment().subtract(CHAT_RETENTION_MONTHS, 'months').format('YYYY-MM-DD');

    const oldServiceIds = await this.servicesRepository
      .createQueryBuilder('service')
      .select('service.id', 'id')
      .where('service.date < :cutoff', { cutoff })
      .getRawMany<{ id: string }>();

    const serviceIds = oldServiceIds.map((service) => service.id);
    if (!serviceIds.length) {
      return;
    }

    const messages = await this.chatMessagesRepository.find({
      where: { serviceId: In(serviceIds) },
    });

    await Promise.all(messages.map((message) => this.removeAttachment(message)));

    await this.chatMessagesRepository.delete({ serviceId: In(serviceIds) });
  }

  private async removeAttachment(message: ServiceChatMessagesEntity) {
    if (!message.attachmentPath) {
      return;
    }

    const normalizedPath = message.attachmentPath.replace(/^\/+/, '');
    const absolutePath = join(process.cwd(), normalizedPath);

    try {
      await fs.unlink(absolutePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        this.logger.warn(`Failed to delete ${absolutePath}`);
      }
    }
  }
}
