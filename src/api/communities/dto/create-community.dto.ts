import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsOptional, IsLatitude, IsLongitude, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCommunityDto {
    @ApiProperty({ description: 'Nombre de la comunidad', maxLength: 80 })
    @IsNotEmpty()
    @IsString()
    communityName: string;

    @ApiProperty({ description: 'Indica si la comunidad debe visualizarse en reportes', example: true, required: false, default: true })
    @IsOptional()
    @IsBoolean()
    showInReports?: boolean;

    @ApiProperty({ description: 'ID del supervisor de la comunidad', example: '1', required: false })
    @IsOptional()
    @IsString()
    supervisorUserId?: string;

    @ApiProperty({ description: 'ID del manager de la comunidad', example: '1', required: false })
    @IsOptional()
    @IsString()
    managerUserId?: string;

    @ApiProperty({ description: 'ID de la compañía asociada', example: '1' })
    @IsNotEmpty()
    @IsString()
    companyId: string;

    @ApiProperty({ description: 'Latitud del complex (null para quitar la ubicación)', example: 28.5383, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @Type(() => Number)
    @IsLatitude()
    latitude?: number | null;

    @ApiProperty({ description: 'Longitud del complex (null para quitar la ubicación)', example: -81.3792, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @Type(() => Number)
    @IsLongitude()
    longitude?: number | null;
}
