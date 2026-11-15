import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const PENDING_CHANGE_STATUSES = ['pending', 'approved', 'rejected', 'executed', 'failed', 'expired'] as const;

export class ApprovalsQueryDto {
  @ApiPropertyOptional({ enum: PENDING_CHANGE_STATUSES })
  @IsOptional()
  @IsIn(PENDING_CHANGE_STATUSES as unknown as string[])
  readonly status?: (typeof PENDING_CHANGE_STATUSES)[number];

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  readonly take?: number = 20;
}
