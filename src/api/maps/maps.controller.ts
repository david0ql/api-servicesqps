import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { MapsService } from './maps.service';

/**
 * Publico a proposito: lo abre el cleaner desde el SMS y lo consultan los bots
 * que arman la vista previa del link (WhatsApp, iMessage), que no mandan token.
 * Solo expone nombre y coordenada de la comunidad, nada sensible.
 */
@ApiExcludeController()
@Controller('m')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get(':id')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async pagina(@Param('id') id: string) {
    return this.mapsService.obtenerPagina(id);
  }

  @Get(':id/img.png')
  async imagen(@Param('id') id: string, @Res() response: Response) {
    const imagen = await this.mapsService.obtenerImagen(id);
    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'public, max-age=86400');
    response.end(imagen);
  }
}
