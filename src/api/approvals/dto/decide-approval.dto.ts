import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideApprovalDto {
  @ApiPropertyOptional({ example: 'Falta confirmar la fecha con la comunidad' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly comment?: string;
}
