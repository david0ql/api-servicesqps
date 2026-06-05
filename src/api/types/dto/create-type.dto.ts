import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateTypeDto {
    @ApiProperty({
        description: 'Descripción del tipo',
        example: 'Limpieza profunda de alfombras',
        maxLength: 191,
    })
    @IsString()
    description: string;

    @ApiProperty({
        description: 'Tipo de limpieza',
        example: 'Residencial',
        maxLength: 191,
    })
    @IsString()
    cleaningType: string;

    @ApiProperty({
        description: 'Precio del servicio de este tipo',
        example: 150.75,
    })
    @IsNumber()
    price: number;

    @ApiProperty({
        description:
            'Comisión asociada al tipo (valor decimal). Si no se especifica, el valor por defecto es "0.00"',
        example: '0.00',
        default: '0.00',
    })
    @IsString()
    commission: number;

    @ApiProperty({
        description: 'Indica si el tipo debe mostrarse en el móvil',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    showInMobile?: boolean;

    @ApiProperty({
        description:
            'Identificador de la comunidad a la que pertenece este tipo',
        example: '1',
    })
    @IsString()
    communityId: string;
}
