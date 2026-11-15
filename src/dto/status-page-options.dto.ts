import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PageOptionsDto } from './page-options.dto';

export type ActiveStatusFilter = 'active' | 'inactive' | 'all';

/** Paginación + filtro por estado (active / inactive) para listados con isActive. */
export class StatusPageOptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado: active = solo activos, inactive = solo inactivos, all = todos.',
    enum: ['active', 'inactive', 'all'],
  })
  @IsIn(['active', 'inactive', 'all'])
  @IsOptional()
  readonly status?: ActiveStatusFilter;
}
