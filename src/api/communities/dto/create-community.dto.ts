import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsOptional, IsLatitude, IsLongitude, ValidateIf, IsNumber, Min, Max, MaxLength } from 'class-validator';
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

    @ApiProperty({ description: 'Indica si el complex utiliza cera (wax)', example: false, required: false, default: false })
    @IsOptional()
    @IsBoolean()
    useWax?: boolean;

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

    @ApiProperty({ description: 'Comunidad activa. Las inactivas no aparecen al crear servicios', example: true, required: false, default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ description: 'ID del vendedor asociado que consiguio el complex', example: '220', required: false, nullable: true })
    @IsOptional()
    @IsString()
    vendorUserId?: string | null;

    @ApiProperty({ description: 'Porcentaje de comision del vendedor (0.10 = 10%)', example: 0.10, required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(1)
    vendorCommissionRate?: number | null;

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

    // Contactos del complex que el cleaner puede llamar desde la app.
    @ApiProperty({ description: 'Nombre del supervisor de mantenimiento', example: 'John Doe', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsString()
    @MaxLength(120)
    maintenanceSupervisorName?: string | null;

    @ApiProperty({ description: 'Telefono del supervisor de mantenimiento', example: '+1 407 555 0100', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsString()
    @MaxLength(30)
    maintenanceSupervisorPhone?: string | null;

    @ApiProperty({ description: 'Nombre del tecnico', example: 'Jane Doe', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsString()
    @MaxLength(120)
    technicianName?: string | null;

    @ApiProperty({ description: 'Telefono del tecnico', example: '+1 407 555 0101', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsString()
    @MaxLength(30)
    technicianPhone?: string | null;

    @ApiProperty({ description: 'Nombre del manager (contacto)', example: 'Mary Smith', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsString()
    @MaxLength(120)
    managerContactName?: string | null;

    @ApiProperty({ description: 'Telefono del manager (contacto)', example: '+1 407 555 0102', required: false, nullable: true })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsString()
    @MaxLength(30)
    managerContactPhone?: string | null;

    @ApiProperty({ description: 'Mostrar los contactos del complex en la app del cleaner', example: false, required: false, default: false })
    @IsOptional()
    @IsBoolean()
    showContactsInApp?: boolean;
}
