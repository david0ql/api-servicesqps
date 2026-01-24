import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsOptional, IsString } from "class-validator";

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
}
