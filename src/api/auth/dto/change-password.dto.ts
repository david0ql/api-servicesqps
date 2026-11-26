import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Clave actual', example: '1234' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  // Mínimo 4: las claves actuales son cortas (ej. 1234). Máx. 72 por bcrypt.
  @ApiProperty({ description: 'Clave nueva (mínimo 4 caracteres)', example: '5678' })
  @IsString()
  @MinLength(4)
  @MaxLength(72)
  newPassword: string;
}
