import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsString } from "class-validator";

export class CreateCostDto {
    @ApiProperty({
        description: 'Fecha del costo',
        example: '2025-02-07',
    })
    @IsDateString()
    date: string;

    @ApiProperty({
        description: 'Descripción del costo',
        example: 'Pago de servicios mensuales',
    })
    @IsString()
    description: string;

    @ApiProperty({
        description: 'Monto del costo (valor decimal)',
        example: '150.00',
    })
    @IsString()
    amount: string;
}
