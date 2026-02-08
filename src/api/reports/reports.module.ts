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
import { UsersEntity } from '../../entities/users.entity';
import { CleanerReportLinksEntity } from '../../entities/cleaner_report_links.entity';
import { TextBeeModule } from '../../textbee/textbee.module';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  imports: [
    PrinterModule,
    TextBeeModule,
    TypeOrmModule.forFeature([
      CostsEntity,
      RecurringCostsEntity,
      ServicesEntity,
      ExtrasByServiceEntity,
      CommunitiesEntity,
      UsersEntity,
      CleanerReportLinksEntity,
    ]),
  ],
})
export class ReportsModule { }
