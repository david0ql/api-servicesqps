import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import type { BlackoutPeriod } from '../../../entities/community_blackouts.entity';

export const BLACKOUT_PERIODS: BlackoutPeriod[] = ['full_day', 'am', 'pm', 'custom'];
const TIME_PATTERN = /^(([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?|24:00(:00)?)$/;

export class CreateCommunityBlackoutDto {
  @ApiPropertyOptional({ description: 'Comunidad a bloquear', example: '5' })
  @IsOptional()
  @IsString()
  communityId?: string;

  @ApiPropertyOptional({ description: 'Aplicar el mismo bloqueo a varias comunidades', example: ['5', '8'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  communityIds?: string[];

  @ApiPropertyOptional({ description: 'Aplicar a todas las comunidades activas' })
  @IsOptional()
  @IsBoolean()
  allCommunities?: boolean;

  @ApiProperty({ example: '2026-11-26' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Fin del rango (inclusive). Si se omite, es un solo dia.', example: '2026-11-27' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ enum: BLACKOUT_PERIODS, description: 'full_day | am (00:00-12:00) | pm (12:00-24:00) | custom' })
  @IsIn(BLACKOUT_PERIODS)
  period: BlackoutPeriod;

  @ApiPropertyOptional({ description: 'Solo custom. HH:mm o HH:mm:ss', example: '08:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'startTime debe tener formato HH:mm' })
  startTime?: string;

  @ApiPropertyOptional({ description: 'Solo custom. HH:mm o HH:mm:ss (24:00 = fin del dia)', example: '14:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'endTime debe tener formato HH:mm' })
  endTime?: string;

  @ApiPropertyOptional({ example: 'Thanksgiving' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
