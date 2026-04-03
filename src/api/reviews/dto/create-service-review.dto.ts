import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsBoolean, IsNumber, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class ReviewItemValueDto {
  @ApiProperty({ description: 'Review item ID' })
  @IsString()
  reviewItemId: string;

  @ApiProperty({ description: 'Review value (boolean)' })
  @IsBoolean()
  value: boolean;
}

export class CreateServiceReviewDto {
  @ApiProperty({ description: 'Service ID' })
  @IsString()
  serviceId: string;

  @ApiProperty({ description: 'Message' })
  @IsString()
  message?: string;

  @ApiProperty({ description: 'Array of review items with values', type: [ReviewItemValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemValueDto)
  reviewItems: ReviewItemValueDto[];

  // QA finish location
  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() accuracy?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() altitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() altitudeAccuracy?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() heading?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() speed?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() capturedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() meta?: Record<string, any>;
} 