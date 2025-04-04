import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RolesEntity } from '../../entities/roles.entity';
import { UsersEntity } from '../../entities/users.entity';

import { PushNotificationsService } from '../../push-notification/push-notification.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PushNotificationsService],
  imports: [TypeOrmModule.forFeature([RolesEntity, UsersEntity])]
})

export class UsersModule { }
