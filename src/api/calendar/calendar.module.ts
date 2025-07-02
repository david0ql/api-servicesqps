import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

import { ServicesEntity } from '../../entities/services.entity';
import { ReviewsByServiceEntity } from '../../entities/reviews_by_service.entity';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService],
  imports: [TypeOrmModule.forFeature([ServicesEntity, ReviewsByServiceEntity])],
})

export class CalendarModule { }
