import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({ description: 'Titulo de la noticia', example: 'Nuevo protocolo de limpieza' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @ApiProperty({ description: 'Contenido de la noticia', example: 'A partir del lunes...' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: 'Ruta de la imagen subida con POST /news/upload-image (ej. /uploads/news/123.jpg)',
    example: '/uploads/news/1700000000000-123.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Ids de rol que ven la noticia. null o vacio = todos los usuarios de la app.',
    example: ['4', '7'],
    nullable: true,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => String(item)) : value))
  audienceRoles?: string[] | null;

  @ApiPropertyOptional({
    description: 'Usuarios específicos. Si un rol tiene usuarios elegidos, de ese rol solo ellos ven la noticia.',
    example: ['120', '135'],
    nullable: true,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => String(item)) : value))
  audienceUserIds?: string[] | null;

  @ApiPropertyOptional({ description: 'Publicar la noticia (envia push la primera vez)', example: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
