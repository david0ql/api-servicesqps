import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FindCommunityBlackoutsDto {
  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  communityId?: string;

  @ApiPropertyOptional({ description: 'Devuelve bloqueos que terminan desde esta fecha', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Devuelve bloqueos que empiezan hasta esta fecha', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
