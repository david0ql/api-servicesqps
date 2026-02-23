import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RecurringCostsEntity } from 'src/entities/recurring_costs.entity';
import { RecurringCostsController } from './recurring-costs.controller';
import { RecurringCostsService } from './recurring-costs.service';

@Module({
  imports: [TypeOrmModule.forFeature([RecurringCostsEntity])],
  controllers: [RecurringCostsController],
  providers: [RecurringCostsService],
})
export class RecurringCostsModule {}
