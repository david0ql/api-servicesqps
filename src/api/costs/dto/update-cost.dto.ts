import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { CreateCostDto } from './create-cost.dto';

export class UpdateCostDto extends PartialType(CreateCostDto) {
    @ApiProperty({
        description: 'The id of the cost',
        example: "1",
        required: false,
    })
    @IsOptional()
    @IsString()
    id?: string
}
