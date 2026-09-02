import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CommunitiesEntity } from '../../entities/communities.entity';
import { generarMapaEstatico } from './static-map.util';
import envVars from '../../config/env';

/**
 * Pagina publica de ubicacion de un complex, pensada para el link del SMS.
 *
 * El link directo a Google Maps NO sirve para vista previa: Google publica un
 * og:image que ignora las coordenadas del link y devuelve un mapa de la
 * ubicacion de QUIEN pide la vista previa (comprobado: pidiendo el link de un
 * complex de Orlando devolvia un mapa de Bucaramanga). Por eso servimos
 * nosotros la pagina, con un og:image que si es el mapa del complex.
 */
@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  /** Las imagenes se cachean por complex+coordenada: si mueven el pin, la
   *  clave cambia sola y se regenera. Son ~200 KB c/u y hay pocas decenas. */
  private readonly cacheImagenes = new Map<string, Buffer>();
  private static readonly MAX_CACHE = 200;

  constructor(
    @InjectRepository(CommunitiesEntity)
    private readonly communitiesRepository: Repository<CommunitiesEntity>,
  ) {}

  private async buscarConUbicacion(id: string) {
    const community = await this.communitiesRepository.findOne({
      where: { id },
      select: ['id', 'communityName', 'latitude', 'longitude'],
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const latitude = Number(community.latitude);
    const longitude = Number(community.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
      throw new NotFoundException('Community has no location');
    }

    return { community, latitude, longitude };
  }

  async obtenerImagen(id: string): Promise<Buffer> {
    const { latitude, longitude } = await this.buscarConUbicacion(id);
    const clave = `${id}:${latitude}:${longitude}`;

    const enCache = this.cacheImagenes.get(clave);
    if (enCache) return enCache;

    const imagen = await generarMapaEstatico({ latitude, longitude });

    if (this.cacheImagenes.size >= MapsService.MAX_CACHE) {
      this.cacheImagenes.delete(this.cacheImagenes.keys().next().value);
    }
    this.cacheImagenes.set(clave, imagen);
    this.logger.log(`Mapa generado para la comunidad ${id} (${imagen.length} bytes)`);

    return imagen;
  }

  async obtenerPagina(id: string): Promise<string> {
    const { community, latitude, longitude } = await this.buscarConUbicacion(id);

    const base = (envVars.REPORTS_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const imagen = `${base}/m/${id}/img.png`;
    // Directions: el cleaner viene manejando, le sirve mas que el pin suelto.
    const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    const verPin = `https://maps.google.com/?q=${latitude},${longitude}`;
    const nombre = escapar(community.communityName ?? 'Complex');

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${nombre}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${nombre}">
<meta property="og:description" content="Toca para abrir la ruta hasta el complex.">
<meta property="og:image" content="${imagen}">
<meta property="og:image:width" content="640">
<meta property="og:image:height" content="336">
<meta property="og:image:alt" content="Mapa de ${nombre}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${nombre}">
<meta name="twitter:image" content="${imagen}">
<style>
  body{margin:0;font:16px/1.4 system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a}
  .caja{max-width:640px;margin:0 auto;padding:16px}
  h1{font-size:1.25rem;margin:0 0 12px}
  img{width:100%;border-radius:12px;display:block;border:1px solid #e2e8f0}
  a.boton{display:block;margin-top:14px;padding:14px;border-radius:10px;background:#2563eb;color:#fff;
          text-align:center;text-decoration:none;font-weight:600}
  a.secundario{display:block;margin-top:8px;padding:12px;text-align:center;color:#2563eb;text-decoration:none}
  p.nota{color:#64748b;font-size:.8rem;text-align:center;margin-top:14px}
</style>
</head>
<body>
  <div class="caja">
    <h1>${nombre}</h1>
    <img src="${imagen}" alt="Mapa de ${nombre}" width="640" height="336">
    <a class="boton" href="${comoLlegar}">Cómo llegar</a>
    <a class="secundario" href="${verPin}">Ver el punto en el mapa</a>
    <p class="nota">Mapa &copy; OpenStreetMap</p>
  </div>
  <script>
    // Al cleaner le abrimos la ruta de una. Los bots que arman la vista previa
    // no ejecutan JS, asi que ellos si leen las etiquetas og: de arriba.
    location.replace(${JSON.stringify(comoLlegar)});
  </script>
</body>
</html>`;
  }
}

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
