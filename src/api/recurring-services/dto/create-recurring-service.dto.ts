import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateRecurringServiceDto {
  @ApiProperty({ description: 'The id of the community', example: '5' })
  @IsString()
  communityId: string;

  @ApiProperty({ description: 'The id of the type', example: '1' })
  @IsString()
  typeId: string;

  @ApiProperty({ description: 'The id of the status', example: '1' })
  @IsString()
  statusId: string;

  @ApiProperty({ description: 'The size of the unity', example: '1 Bedroom' })
  @IsString()
  unitySize: string;

  @ApiProperty({ description: 'The number of the unity', example: 'Leasing Center' })
  @IsString()
  unitNumber: string;

  @ApiProperty({ description: 'The schedule of the service', example: '08:00:00', required: false })
  @IsOptional()
  @IsString()
  schedule?: string | null;

  @ApiProperty({ description: 'The comment of the service', example: 'This is a comment', required: false })
  @IsOptional()
  @IsString()
  comment?: string | null;

  @ApiProperty({ description: 'The cleaner comment of the service', example: 'This is a comment', required: false })
  @IsOptional()
  @IsString()
  userComment?: string | null;

  @ApiProperty({ description: 'The id of the user', example: '1', required: false })
  @IsOptional()
  @IsString()
  userId?: string | null;

  @ApiProperty({ description: 'Days of week', example: ['mon', 'wed', 'fri'] })
  @IsArray()
  @IsString({ each: true })
  daysOfWeek: string[];

  @ApiProperty({ description: 'Extra ids', example: ['1', '2'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraIds?: string[] | null;

  @ApiProperty({ description: 'Active flag', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
