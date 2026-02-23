import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export enum Order {
    ASC = "ASC",
    DESC = "DESC",
}

export class PageOptionsDto {
    @ApiPropertyOptional({ enum: Order, default: Order.ASC })
    @IsEnum(Order)
    @IsOptional()
    readonly order?: Order = Order.ASC;

    @ApiPropertyOptional({
        minimum: 1,
        default: 1,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    readonly page?: number = 1;

    @ApiPropertyOptional({
        description: 'Filtrar solo registros activos (ej: usuarios)',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => (value === undefined || value === '' ? undefined : value === 'true' || value === true))
    readonly activeOnly?: boolean;

    @ApiPropertyOptional({
        minimum: 1,
        maximum: 150,
        default: 10,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(150)
    @IsOptional()
    readonly take?: number = 10;

    get skip(): number {
        return (this.page - 1) * this.take;
    }
}