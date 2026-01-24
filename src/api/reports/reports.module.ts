import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CostsEntity } from '../../entities/costs.entity';
import { RecurringCostsEntity } from '../../entities/recurring_costs.entity';
import { ExtrasByServiceEntity } from '../../entities/extras_by_service.entity';
import { ServicesEntity } from '../../entities/services.entity';
import { PrinterModule } from '../../printer/printer.module';
import { CommunitiesEntity } from '../../entities/communities.entity';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  imports: [PrinterModule, TypeOrmModule.forFeature([CostsEntity, RecurringCostsEntity, ServicesEntity, ExtrasByServiceEntity, CommunitiesEntity])],
})
export class ReportsModule { }
