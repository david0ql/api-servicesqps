import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class TrackServiceLocationDto {
  @ApiProperty({ description: 'Latitude captured by the device', example: 28.538335 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: 'Longitude captured by the device', example: -81.379234 })
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ description: 'GPS accuracy in meters', example: 7.5 })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional({ description: 'Altitude in meters', example: 30.2 })
  @IsOptional()
  @IsNumber()
  altitude?: number;

  @ApiPropertyOptional({ description: 'Altitude accuracy in meters', example: 12.1 })
  @IsOptional()
  @IsNumber()
  altitudeAccuracy?: number;

  @ApiPropertyOptional({ description: 'Heading in degrees', example: 270.0 })
  @IsOptional()
  @IsNumber()
  heading?: number;

  @ApiPropertyOptional({ description: 'Speed in meters/second', example: 0.3 })
  @IsOptional()
  @IsNumber()
  speed?: number;

  @ApiPropertyOptional({ description: 'ISO datetime from device capture time', example: '2026-03-07T13:45:00.000Z' })
  @IsOptional()
  @IsString()
  capturedAt?: string;

  @ApiPropertyOptional({ description: 'Raw location metadata', example: { mocked: false, provider: 'gps' } })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}
