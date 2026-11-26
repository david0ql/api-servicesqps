import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RecurringServicesController } from './recurring-services.controller';
import { RecurringServicesService } from './recurring-services.service';
import { RecurringServicesEntity } from 'src/entities/recurring_services.entity';
import { ServicesEntity } from 'src/entities/services.entity';
import { UsersEntity } from 'src/entities/users.entity';
import { ServicesModule } from '../services/services.module';
import { CommunityBlackoutsModule } from '../community-blackouts/community-blackouts.module';
import { UsersModule } from '../users/users.module';

@Module({
  controllers: [RecurringServicesController],
  providers: [RecurringServicesService],
  imports: [
    ServicesModule,
    CommunityBlackoutsModule,
    UsersModule,
    TypeOrmModule.forFeature([RecurringServicesEntity, ServicesEntity, UsersEntity]),
  ],
})
export class RecurringServicesModule {}
