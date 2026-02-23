import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ServiceChatController } from './service-chat.controller';
import { ServiceChatCleanupService } from './service-chat.cleanup.service';
import { ServiceChatGateway } from './service-chat.gateway';
import { ServiceChatService } from './service-chat.service';
import { ServiceChatMessagesEntity } from '../../entities/service_chat_messages.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { UsersEntity } from '../../entities/users.entity';
import { NotificationsModule } from '../../push-notification/push-notification.module';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      ServiceChatMessagesEntity,
      ServicesEntity,
      UsersEntity,
    ]),
  ],
  controllers: [ServiceChatController],
  providers: [ServiceChatService, ServiceChatGateway, ServiceChatCleanupService],
})
export class ServiceChatModule {}
