import { PartialType } from '@nestjs/swagger';
import { CreateRecurringServiceDto } from './create-recurring-service.dto';

export class UpdateRecurringServiceDto extends PartialType(CreateRecurringServiceDto) {}
