import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import moment from 'moment';

import { isChatOpenStatus } from '../../constants/service-status.enum';
import { ServiceChatMessagesEntity } from '../../entities/service_chat_messages.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { UsersEntity } from '../../entities/users.entity';

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

const CHAT_ALLOWED_ROLES = new Set<string>(['1', '4', '6']);
const MAX_MESSAGE_LENGTH = 2000;
const CHAT_RETENTION_MONTHS = 3;
const SYSTEM_USER: ServiceChatUser = {
  id: '0',
  name: 'System',
  roleId: null,
};

@Injectable()
export class ServiceChatService {
  constructor(
    @InjectRepository(ServiceChatMessagesEntity)
    private readonly chatMessagesRepository: Repository<ServiceChatMessagesEntity>,
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
  ) {}

  roomName(serviceId: string) {
    return `service:${serviceId}`;
  }

  async getChatHistory(serviceId: string, user: UsersEntity): Promise<ServiceChatHistoryDto> {
    const service = await this.getServiceForChat(serviceId, user);
    const isAdmin = user?.roleId === '1';
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
      canSend: isExpired ? false : isAdmin || isChatOpenStatus(service.statusId),
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

    const isAdmin = user?.roleId === '1';
    if (!isAdmin && !isChatOpenStatus(service.statusId)) {
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

    return {
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

  private async getServiceForChat(serviceId: string, user: ServiceChatUser | UsersEntity) {
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId },
      relations: ['community'],
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    if (!user?.id || !CHAT_ALLOWED_ROLES.has(user.roleId ?? '')) {
      throw new ForbiddenException('Chat is only available to cleaners, supervisors, and admins.');
    }

    const isAdmin = user.roleId === '1';
    if (!isAdmin) {
      const isCleaner = user.roleId === '4' && service.userId === user.id;
      const isSupervisor =
        user.roleId === '6' && service.community?.supervisorUserId === user.id;

      if (!isCleaner && !isSupervisor) {
        throw new ForbiddenException('Chat is only available to the assigned cleaner and supervisor.');
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
}
