import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString } from 'class-validator';

export class RequirePasswordChangeByRoleDto {
  @ApiProperty({ description: 'Rol cuyos usuarios activos deberán cambiar la clave (4 = Cleaner)', example: '4' })
  @IsNumberString()
  @IsNotEmpty()
  roleId: string;
}
