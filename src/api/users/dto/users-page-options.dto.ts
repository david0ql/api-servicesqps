import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PageOptionsDto } from '../../../dto/page-options.dto';

/**
 * Filtros del listado de usuarios.
 *
 * `roleId` existe porque el tope de `take` es 150: cuando la tabla de usuarios
 * pasa de ese numero, traer la pagina completa y filtrar en el navegador deja
 * fuera a los mas recientes. Fue justo lo que paso con los vendedores, que al
 * ser las cuentas mas nuevas quedaban del corte hacia afuera y el desplegable
 * de "Vendedor asociado" salia vacio.
 */
export class UsersPageOptionsDto extends PageOptionsDto {
  @ApiPropertyOptional({
    description: 'Devolver solo los usuarios de este rol (ej: 8 = Vendedor)',
    example: '8',
  })
  @IsString()
  @IsOptional()
  readonly roleId?: string;
}
