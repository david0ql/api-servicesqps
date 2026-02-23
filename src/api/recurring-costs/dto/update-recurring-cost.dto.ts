import { PartialType } from '@nestjs/swagger';
import { CreateRecurringCostDto } from './create-recurring-cost.dto';

export class UpdateRecurringCostDto extends PartialType(CreateRecurringCostDto) {}
