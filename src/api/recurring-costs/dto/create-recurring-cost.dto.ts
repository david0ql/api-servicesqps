import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { COST_CATEGORY_VALUES, CostCategory, DEFAULT_COST_CATEGORY } from "src/constants/cost-categories";

export class CreateRecurringCostDto {
  @ApiProperty({
    description: "Descripcion del costo recurrente",
    example: "GoDaddy (email QPS)",
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: "Monto del costo recurrente (valor decimal)",
    example: "2.50",
  })
  @IsString()
  amount: string;

  @ApiProperty({
    description: "Fecha de inicio",
    example: "2025-01-01",
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: "Fecha de fin (opcional)",
    example: "2025-12-31",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiProperty({
    description: "Indica si el costo esta activo",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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
