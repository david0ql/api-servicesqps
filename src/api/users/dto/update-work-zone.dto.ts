import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

const toStringArray = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map((v) => String(v)) : value;

export class UpdateWorkZoneDto {
  @ApiPropertyOptional({ description: 'Comunidades donde trabaja la cleaner', example: ['12', '15'] })
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  communityIds?: string[];

  @ApiPropertyOptional({ description: 'Companias (todas sus comunidades) donde trabaja la cleaner', example: ['3'] })
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  companyIds?: string[];

  @ApiPropertyOptional({
    description: 'Geocerca libre: GeoJSON FeatureCollection de Polygon/MultiPolygon, coordenadas [lng, lat]. null = sin poligonos.',
    example: { type: 'FeatureCollection', features: [] },
  })
  @IsOptional()
  zones?: unknown;
}

export class EligibleCleanersQueryDto {
  @ApiPropertyOptional({ description: 'Comunidad del servicio', example: '12' })
  @IsString()
  communityId: string;
}
