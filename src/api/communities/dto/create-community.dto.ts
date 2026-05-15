import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsOptional } from 'class-validator';

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
}
