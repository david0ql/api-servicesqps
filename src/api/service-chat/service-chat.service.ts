import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import moment from 'moment';

import { isChatOpenStatus } from '../../constants/service-status.enum';
import { ServiceChatMessagesEntity } from '../../entities/service_chat_messages.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { UsersEntity } from '../../entities/users.entity';
import { PushNotificationsService } from '../../push-notification/push-notification.service';
import { PageDto } from '../../dto/page.dto';
import { PageMetaDto } from '../../dto/page-meta.dto';
import { PageOptionsDto } from '../../dto/page-options.dto';
import { ServiceChatThreadDto } from './dto/service-chat-thread.dto';

export interface ServiceChatUser {
  id: string;
  name: string;
  roleId: string | null;
}

export interface ServiceChatMessageDto {
  id: string;
  serviceId: string;
  userId: string;
  message: string | null;
  attachmentPath?: string | null;
  attachmentType?: string | null;
  attachmentMime?: string | null;
  attachmentName?: string | null;
  createdAt: Date;
  user?: ServiceChatUser;
}

export interface ServiceChatHistoryDto {
  serviceId: string;
  statusId: string | null;
  canSend: boolean;
  messages: ServiceChatMessageDto[];
}

export interface ServiceChatAttachment {
  path: string;
  mime: string | null;
  name: string | null;
}

export interface ServiceChatNotifyPayload {
  serviceId: string;
  senderId: string;
  senderName: string;
  message: string | null;
  hasAttachment: boolean;
  communityName: string | null;
  unitNumber: string | null;
}

const CHAT_ALLOWED_ROLES = new Set<string>(['1', '4', '7']);
const MAX_MESSAGE_LENGTH = 2000;
const CHAT_RETENTION_MONTHS = 3;
const MAX_NOTIFICATION_LENGTH = 140;
const SYSTEM_USER: ServiceChatUser = {
  id: '0',
  name: 'System',
  roleId: null,
};

@Injectable()
export class ServiceChatService {
  private readonly logger = new Logger(ServiceChatService.name);

  constructor(
    @InjectRepository(ServiceChatMessagesEntity)
    private readonly chatMessagesRepository: Repository<ServiceChatMessagesEntity>,
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  roomName(serviceId: string) {
    return `service:${serviceId}`;
  }

  async getChatHistory(serviceId: string, user: UsersEntity): Promise<ServiceChatHistoryDto> {
    const service = await this.getServiceForChat(serviceId, user);
    const isExpired = this.isServiceExpired(service.date);

    if (isExpired) {
      return {
        serviceId,
        statusId: service.statusId,
        canSend: false,
        messages: [
          {
            id: '0',
            serviceId,
            userId: SYSTEM_USER.id,
            message:
              'Chat eliminado: este servicio tiene mas de 3 meses de antiguedad.',
            createdAt: new Date(),
            user: SYSTEM_USER,
          },
        ],
      };
    }

    const messages = await this.chatMessagesRepository
      .createQueryBuilder('message')
      .leftJoin('message.user', 'user')
      .select(['message'])
      .addSelect(['user.id', 'user.name', 'user.roleId'])
      .where('message.serviceId = :serviceId', { serviceId })
      .orderBy('message.createdAt', 'ASC')
      .getMany();

    return {
      serviceId,
      statusId: service.statusId,
      canSend: isExpired ? false : isChatOpenStatus(service.statusId),
      messages: messages.map((message) => this.toMessageDto(message)),
    };
  }

  async createMessage(
    serviceId: string,
    user: ServiceChatUser,
    message: string | null,
    attachment?: {
      path: string;
      type: string;
      mime: string;
      name: string;
    }
  ): Promise<ServiceChatMessageDto> {
    const service = await this.getServiceForChat(serviceId, user);

    if (this.isServiceExpired(service.date)) {
      throw new ForbiddenException('Chat is unavailable for services older than 3 months.');
    }

    if (!isChatOpenStatus(service.statusId)) {
      throw new ForbiddenException('Chat is closed for this service status.');
    }

    const normalizedMessage = message?.trim() || null;
    const hasAttachment = Boolean(attachment?.path);

    if (!normalizedMessage && !hasAttachment) {
      throw new BadRequestException('Message cannot be empty.');
    }

    if (normalizedMessage && normalizedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
      );
    }

    const chatMessage = this.chatMessagesRepository.create({
      serviceId,
      userId: user.id,
      message: normalizedMessage,
      attachmentPath: attachment?.path ?? null,
      attachmentType: attachment?.type ?? null,
      attachmentMime: attachment?.mime ?? null,
      attachmentName: attachment?.name ?? null,
    });

    const savedMessage = await this.chatMessagesRepository.save(chatMessage);

    const response: ServiceChatMessageDto = {
      id: savedMessage.id,
      serviceId: savedMessage.serviceId,
      userId: savedMessage.userId,
      message: savedMessage.message,
      attachmentPath: savedMessage.attachmentPath,
      attachmentType: savedMessage.attachmentType,
      attachmentMime: savedMessage.attachmentMime,
      attachmentName: savedMessage.attachmentName,
      createdAt: savedMessage.createdAt,
      user,
    };

    this.notifyChatParticipants(service, user, response).catch((error) => {
      this.logger.error('Failed to notify chat participants', error);
    });

    return response;
  }

  async assertChatAccess(serviceId: string, user: ServiceChatUser) {
    await this.getServiceForChat(serviceId, user);
  }

  async getAttachmentForMessage(
    serviceId: string,
    messageId: string,
    user: ServiceChatUser,
  ): Promise<ServiceChatAttachment> {
    const service = await this.getServiceForChat(serviceId, user);

    if (this.isServiceExpired(service.date)) {
      throw new ForbiddenException('Chat deleted for services older than 3 months.');
    }

    const message = await this.chatMessagesRepository.findOne({
      where: { id: messageId, serviceId },
    });

    if (!message || !message.attachmentPath) {
      throw new NotFoundException('Attachment not found.');
    }

    return {
      path: message.attachmentPath,
      mime: message.attachmentMime,
      name: message.attachmentName,
    };
  }

  async getNotificationRecipientIds(serviceId: string, senderId: string): Promise<string[]> {
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    const recipients = await this.resolveChatRecipients(service, senderId);
    return recipients.map((recipient) => recipient.id);
  }

  async buildNotifyPayload(
    serviceId: string,
    sender: ServiceChatUser,
    message: ServiceChatMessageDto,
  ): Promise<ServiceChatNotifyPayload | null> {
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId },
      relations: ['community'],
    });

    if (!service) {
      return null;
    }

    return {
      serviceId,
      senderId: sender.id,
      senderName: sender.name,
      message: message.message ?? null,
      hasAttachment: Boolean(message.attachmentPath),
      communityName: service.community?.communityName ?? null,
      unitNumber: service.unitNumber ?? null,
    };
  }

  async getChatThreads(
    pageOptionsDto: PageOptionsDto,
    user: ServiceChatUser | UsersEntity,
  ): Promise<PageDto<ServiceChatThreadDto>> {
    const roleId = user?.roleId ?? '';
    const canListAllChats = roleId === '1' || roleId === '7';
    if (!canListAllChats) {
      throw new ForbiddenException('Chat list is only available to QA and super admins.');
    }

    const cutoff = moment()
      .subtract(CHAT_RETENTION_MONTHS, 'months')
      .format('YYYY-MM-DD');

    const totalRaw = await this.chatMessagesRepository
      .createQueryBuilder('message')
      .innerJoin(ServicesEntity, 'service', 'service.id = message.serviceId')
      .where('service.date >= :cutoff', { cutoff })
      .select('COUNT(DISTINCT message.serviceId)', 'count')
      .getRawOne<{ count: string }>();

    const totalCount = Number(totalRaw?.count ?? 0);

    const lastMessageSubQuery = this.chatMessagesRepository
      .createQueryBuilder('m')
      .select('m.serviceId', 'serviceId')
      .addSelect('MAX(m.id)', 'lastMessageId')
      .groupBy('m.serviceId');

    const rows = await this.servicesRepository
      .createQueryBuilder('service')
      .innerJoin(
        `(${lastMessageSubQuery.getQuery()})`,
        'last',
        'last.serviceId = service.id',
      )
      .innerJoin(ServiceChatMessagesEntity, 'message', 'message.id = last.lastMessageId')
      .leftJoin('service.community', 'community')
      .leftJoin('service.user', 'cleaner')
      .leftJoin('message.user', 'sender')
      .where('service.date >= :cutoff', { cutoff })
      .select('service.id', 'serviceId')
      .addSelect('service.statusId', 'statusId')
      .addSelect('service.date', 'date')
      .addSelect('service.schedule', 'schedule')
      .addSelect('community.communityName', 'communityName')
      .addSelect('service.unitNumber', 'unitNumber')
      .addSelect('cleaner.name', 'cleanerName')
      .addSelect('message.id', 'lastMessageId')
      .addSelect('message.userId', 'lastMessageUserId')
      .addSelect('sender.name', 'lastMessageUserName')
      .addSelect('message.message', 'lastMessageText')
      .addSelect('message.attachmentType', 'lastMessageAttachmentType')
      .addSelect('message.attachmentPath', 'lastMessageAttachmentPath')
      .addSelect('message.createdAt', 'lastMessageCreatedAt')
      .orderBy('message.createdAt', 'DESC')
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .setParameters(lastMessageSubQuery.getParameters())
      .getRawMany<{
        serviceId: string;
        statusId: string | null;
        date: string;
        schedule: string | null;
        communityName: string | null;
        unitNumber: string | null;
        cleanerName: string | null;
        lastMessageId: string;
        lastMessageUserId: string | null;
        lastMessageUserName: string | null;
        lastMessageText: string | null;
        lastMessageAttachmentType: string | null;
        lastMessageAttachmentPath: string | null;
        lastMessageCreatedAt: Date;
      }>();

    const data: ServiceChatThreadDto[] = rows.map((row) => ({
      serviceId: row.serviceId,
      statusId: row.statusId,
      date: row.date,
      schedule: row.schedule,
      communityName: row.communityName,
      unitNumber: row.unitNumber,
      cleanerName: row.cleanerName,
      lastMessage: {
        id: row.lastMessageId,
        userId: row.lastMessageUserId,
        userName: row.lastMessageUserName,
        message: row.lastMessageText,
        hasAttachment: Boolean(row.lastMessageAttachmentPath),
        attachmentType: row.lastMessageAttachmentType,
        createdAt: row.lastMessageCreatedAt,
      },
    }));

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });
    return new PageDto(data, pageMetaDto);
  }

  private async getServiceForChat(serviceId: string, user: ServiceChatUser | UsersEntity) {
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId },
      relations: ['community'],
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    if (!user?.id || !CHAT_ALLOWED_ROLES.has(user.roleId ?? '')) {
      throw new ForbiddenException('Chat is only available to cleaners, QA, and admins.');
    }

    const isAdmin = user.roleId === '1';
    const isQa = user.roleId === '7';
    if (!isAdmin && !isQa) {
      const isCleaner = user.roleId === '4' && service.userId === user.id;

      if (!isCleaner) {
        throw new ForbiddenException('Chat is only available to the assigned cleaner, QA, or admin.');
      }
    }

    return service;
  }

  private toMessageDto(message: ServiceChatMessagesEntity): ServiceChatMessageDto {
    return {
      id: message.id,
      serviceId: message.serviceId,
      userId: message.userId,
      message: message.message,
      attachmentPath: message.attachmentPath,
      attachmentType: message.attachmentType,
      attachmentMime: message.attachmentMime,
      attachmentName: message.attachmentName,
      createdAt: message.createdAt,
      user: message.user
        ? {
            id: message.user.id,
            name: message.user.name,
            roleId: message.user.roleId,
          }
        : undefined,
    };
  }

  private isServiceExpired(serviceDate: string | null | undefined): boolean {
    if (!serviceDate) {
      return false;
    }

    const parsedDate = moment(serviceDate, 'YYYY-MM-DD', true);
    if (!parsedDate.isValid()) {
      return false;
    }

    return parsedDate.isBefore(moment().subtract(CHAT_RETENTION_MONTHS, 'months'), 'day');
  }

  private async notifyChatParticipants(
    service: ServicesEntity,
    sender: ServiceChatUser,
    message: ServiceChatMessageDto,
  ) {
    const recipients = await this.resolveChatRecipients(service, sender.id);
    if (recipients.length === 0) {
      return;
    }

    const notification = this.buildNotificationContent(service, sender, message);
    const tokens = recipients
      .map((recipient) => recipient.token)
      .filter((token) => typeof token === 'string' && token.trim() !== '') as string[];
    const usersWithPhone = recipients.filter(
      (recipient) => recipient.phoneNumber && recipient.phoneNumber.trim() !== '',
    );

    if (tokens.length === 0 && usersWithPhone.length === 0) {
      return;
    }

    await this.pushNotificationsService.sendNotification({
      title: notification.title,
      body: notification.body,
      data: notification.data,
      sound: 'default',
      tokensNotification: {
        tokens: Array.from(new Set(tokens)),
        users: usersWithPhone,
      },
    });
  }

  private buildNotificationContent(
    service: ServicesEntity,
    sender: ServiceChatUser,
    message: ServiceChatMessageDto,
  ) {
    const communityName = service.community?.communityName ?? 'Service';
    const unitLabel = service.unitNumber?.trim() ? ` · Unit ${service.unitNumber}` : '';
    const locationLabel = `${communityName}${unitLabel}`;
    const preview = this.truncateNotificationText(
      message.message?.replace(/\s+/g, ' ').trim() || '',
    );

    const body = preview
      ? `New message from ${sender.name} (${locationLabel}): ${preview}`
      : `New ${message.attachmentPath ? 'attachment' : 'message'} from ${sender.name} (${locationLabel}).`;

    return {
      title: 'New chat message',
      body,
      data: {
        serviceId: service.id,
        context: 'service-chat',
      },
    };
  }

  private truncateNotificationText(value: string) {
    if (!value) {
      return '';
    }

    if (value.length <= MAX_NOTIFICATION_LENGTH) {
      return value;
    }

    return `${value.slice(0, MAX_NOTIFICATION_LENGTH - 3)}...`;
  }

  private async resolveChatRecipients(service: ServicesEntity, senderId: string) {
    const adminsAndQa = await this.usersRepository.find({
      where: { roleId: In(['1', '7']) },
      select: ['id', 'name', 'roleId', 'token', 'phoneNumber'],
    });

    const assignedCleaner = service.userId
      ? await this.usersRepository.findOne({
          where: { id: service.userId },
          select: ['id', 'name', 'roleId', 'token', 'phoneNumber'],
        })
      : null;

    const recipients = [
      ...(assignedCleaner ? [assignedCleaner] : []),
      ...adminsAndQa,
    ].filter((recipient) => recipient.id !== senderId);

    const uniqueRecipients = new Map<string, UsersEntity>();
    for (const recipient of recipients) {
      uniqueRecipients.set(recipient.id, recipient);
    }

    return Array.from(uniqueRecipients.values());
  }
}
