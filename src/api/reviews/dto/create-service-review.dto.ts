import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsBoolean, IsNumber, IsOptional, IsObject, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

import { MAX_REFRESH_PHOTOS_PER_REVIEW } from '../refresh-photos.util';

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

  @ApiPropertyOptional({ description: 'Message' })
  @IsOptional()
  @IsString()
  message?: string;

  // Checklist viejo: se mantiene para clientes que aun no actualizan.
  @ApiPropertyOptional({ description: 'Legacy checklist (deprecated)', type: [ReviewItemValueDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemValueDto)
  reviewItems?: ReviewItemValueDto[];

  // Refresh por fotos: photoPath devueltos por POST /reviews/photos/upload.
  // Con 1 o mas fotos la revision es un refresh; sin fotos se aprueba.
  @ApiPropertyOptional({ description: 'photoPath of refresh photos (POST /reviews/photos/upload)', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REFRESH_PHOTOS_PER_REVIEW)
  @IsString({ each: true })
  refreshPhotos?: string[];

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