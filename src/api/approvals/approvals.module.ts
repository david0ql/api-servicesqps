import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TextBeeModule } from '../../textbee/textbee.module';
import { NotificationsModule } from '../../push-notification/push-notification.module';
import { PendingChangesEntity } from '../../entities/pending_changes.entity';
import { UsersEntity } from '../../entities/users.entity';
import { RolesEntity } from '../../entities/roles.entity';

import { ApprovalsService } from './approvals.service';
import { ApprovalExecutorService } from './approval-executor.service';
import { ApprovalInterceptor } from './approval.interceptor';
import { ApprovalsController } from './approvals.controller';
import { TextBeeWebhookController } from './textbee-webhook.controller';
import { AdminPapelSeed } from './admin-papel.seed';

@Module({
  imports: [
    AuthModule,
    TextBeeModule,
    NotificationsModule,
    TypeOrmModule.forFeature([PendingChangesEntity, UsersEntity, RolesEntity]),
  ],
  controllers: [ApprovalsController, TextBeeWebhookController],
  providers: [
    ApprovalsService,
    ApprovalExecutorService,
    AdminPapelSeed,
    // Global: aplica a todos los controllers de la app.
    { provide: APP_INTERCEPTOR, useClass: ApprovalInterceptor },
  ],
  exports: [ApprovalsService],
})
export class ApprovalsModule { }
