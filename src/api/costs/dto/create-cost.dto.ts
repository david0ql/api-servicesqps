import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { COST_CATEGORY_VALUES, CostCategory, DEFAULT_COST_CATEGORY } from "src/constants/cost-categories";

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

    @ApiProperty({
        description: 'Categoria del costo (linea del Schedule C)',
        enum: COST_CATEGORY_VALUES,
        example: DEFAULT_COST_CATEGORY,
        required: false,
    })
    @IsOptional()
    @IsIn(COST_CATEGORY_VALUES)
    category?: CostCategory;
}
