import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RecurringServicesController } from './recurring-services.controller';
import { RecurringServicesService } from './recurring-services.service';
import { RecurringServicesEntity } from 'src/entities/recurring_services.entity';
import { ServicesEntity } from 'src/entities/services.entity';
import { UsersEntity } from 'src/entities/users.entity';
import { ServicesModule } from '../services/services.module';

@Module({
  controllers: [RecurringServicesController],
  providers: [RecurringServicesService],
  imports: [
    ServicesModule,
    TypeOrmModule.forFeature([RecurringServicesEntity, ServicesEntity, UsersEntity]),
  ],
})
export class RecurringServicesModule {}
