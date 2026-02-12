import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @ApiProperty({
        description: 'Contraseña del usuario',
        example: 'miContraseñaSegura123',
    })
    @IsString()
    @IsOptional()
    password?: string;

    @ApiProperty({
        description: 'Indica si el usuario está activo',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
