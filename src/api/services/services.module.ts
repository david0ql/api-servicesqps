import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { ServiceNotifierService } from './service-notifier.service';
import { ServicesEntity } from '../../entities/services.entity';
import { ExtrasByServiceEntity } from '../../entities/extras_by_service.entity';
import { UsersEntity } from '../../entities/users.entity';
import { NotificationsModule } from '../../push-notification/push-notification.module';
import { CommunitiesEntity } from '../../entities/communities.entity';

@Module({
  controllers: [ServicesController],
  providers: [ServicesService, ServiceNotifierService],
  exports: [ServicesService, ServiceNotifierService],
  imports: [
    TypeOrmModule.forFeature([ServicesEntity, ExtrasByServiceEntity, UsersEntity, CommunitiesEntity]),
    NotificationsModule,
  ],

})
export class ServicesModule { }
