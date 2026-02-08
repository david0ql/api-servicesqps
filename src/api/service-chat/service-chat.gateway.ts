import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';

import { UsersEntity } from '../../entities/users.entity';
import { ServiceChatMessageDto, ServiceChatService, ServiceChatUser } from './service-chat.service';

interface JoinPayload {
  serviceId: string;
}

interface SendPayload {
  serviceId: string;
  message: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ServiceChatGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ServiceChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    private readonly serviceChatService: ServiceChatService,
  ) {}

  async handleConnection(client: Socket) {
    const token = this.getTokenFromClient(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersRepository.findOne({
        where: { id: payload.id },
        select: ['id', 'name', 'roleId'],
      });

      if (!user) {
        client.disconnect();
        return;
      }

      client.data.user = {
        id: user.id,
        name: user.name,
        roleId: user.roleId,
      } as ServiceChatUser;

      client.join(this.userRoomName(user.id));
    } catch (error) {
      client.disconnect();
    }
  }

  @SubscribeMessage('serviceChat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ) {
    const user = this.getUserFromClient(client);
    if (!user) {
      client.emit('serviceChat:error', { message: 'Unauthorized.' });
      return;
    }
    const serviceId = payload?.serviceId;

    if (!serviceId) {
      client.emit('serviceChat:error', { message: 'serviceId is required.' });
      return;
    }

    try {
      await this.serviceChatService.assertChatAccess(serviceId, user);
      await client.join(this.serviceChatService.roomName(serviceId));
      client.emit('serviceChat:joined', { serviceId });
    } catch (error) {
      this.emitSocketError(client, error, 'Unable to join chat.');
    }
  }

  @SubscribeMessage('serviceChat:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ) {
    const serviceId = payload?.serviceId;
    if (!serviceId) {
      return;
    }

    await client.leave(this.serviceChatService.roomName(serviceId));
  }

  @SubscribeMessage('serviceChat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendPayload,
  ) {
    const user = this.getUserFromClient(client);
    if (!user) {
      client.emit('serviceChat:error', { message: 'Unauthorized.' });
      return;
    }
    const { serviceId, message } = payload ?? {};

    if (!serviceId) {
      client.emit('serviceChat:error', { message: 'serviceId is required.' });
      return;
    }

    try {
      const newMessage = await this.serviceChatService.createMessage(
        serviceId,
        user,
        message,
      );

      this.server
        .to(this.serviceChatService.roomName(serviceId))
        .emit('serviceChat:new', newMessage);

      this.notifyRecipients(newMessage, user).catch((error) => {
        this.logger.error('Failed to notify chat recipients', error);
      });
    } catch (error) {
      this.emitSocketError(client, error, 'Unable to send message.');
    }
  }

  broadcastMessage(serviceId: string, message: any) {
    if (!this.server) {
      return;
    }

    this.server
      .to(this.serviceChatService.roomName(serviceId))
      .emit('serviceChat:new', message);
  }

  async notifyRecipients(message: ServiceChatMessageDto, sender?: ServiceChatUser) {
    const messageSender = sender ?? message.user;
    if (!messageSender?.id) {
      return;
    }

    await this.emitChatNotification(message.serviceId, messageSender, message);
  }

  private getTokenFromClient(client: Socket): string | null {
    const authToken = client.handshake?.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken;
    }

    const headerToken = client.handshake?.headers?.authorization;
    if (typeof headerToken === 'string' && headerToken.startsWith('Bearer ')) {
      return headerToken.slice(7);
    }

    const queryToken = client.handshake?.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken;
    }

    return null;
  }

  private getUserFromClient(client: Socket): ServiceChatUser | null {
    const user = client.data?.user as ServiceChatUser | undefined;
    if (!user?.id) {
      return null;
    }

    return user;
  }

  private userRoomName(userId: string) {
    return `user:${userId}`;
  }

  private async emitChatNotification(
    serviceId: string,
    sender: ServiceChatUser,
    message: ServiceChatMessageDto,
  ) {
    if (!this.server) {
      return;
    }

    const recipients = await this.serviceChatService.getNotificationRecipientIds(
      serviceId,
      sender.id,
    );

    if (recipients.length === 0) {
      return;
    }

    const payload = await this.serviceChatService.buildNotifyPayload(
      serviceId,
      sender,
      message,
    );

    if (!payload) {
      return;
    }

    recipients.forEach((recipientId) => {
      this.server.to(this.userRoomName(recipientId)).emit('serviceChat:notify', payload);
    });
  }

  private emitSocketError(client: Socket, error: unknown, fallback: string) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as { message?: string }).message || fallback;
      client.emit('serviceChat:error', { message });
      return;
    }

    if (error instanceof WsException) {
      client.emit('serviceChat:error', { message: error.message });
      return;
    }

    client.emit('serviceChat:error', { message: fallback });
  }
}
