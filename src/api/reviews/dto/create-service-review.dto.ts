import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsBoolean } from 'class-validator';
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
} 