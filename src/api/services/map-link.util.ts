/**
 * Link de mapa que se anexa al SMS del servicio.
 *
 * Se usa la forma corta `https://maps.google.com/?q=lat,lng` a proposito:
 *  - Abre la app de Google Maps en Android y en iOS (y Safari -> Apple Maps si
 *    no esta instalada), y el navegador en escritorio.
 *  - Es ~20 caracteres mas corta que la forma documentada
 *    `.../maps/search/?api=1&query=...`. En SMS cada segmento son 160
 *    caracteres y se cobra por segmento, asi que la diferencia importa.
 *
 * Devuelve null si la comunidad no tiene coordenadas cargadas o si vienen
 * corruptas: en ese caso el SMS sale igual que siempre, sin link.
 */
const MAX_DECIMALES = 6; // ~0.1 m de precision, de sobra para ubicar un complex

export function buildMapLink(
  latitude?: string | number | null,
  longitude?: string | number | null,
): string | null {
  const lat = normalizar(latitude, 90);
  const lng = normalizar(longitude, 180);

  if (lat === null || lng === null) {
    return null;
  }

  // 0,0 es el "null island": casi siempre significa coordenada sin cargar.
  if (lat === 0 && lng === 0) {
    return null;
  }

  return `https://maps.google.com/?q=${lat},${lng}`;
}

function normalizar(valor: string | number | null | undefined, tope: number): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const numero = typeof valor === 'number' ? valor : Number(valor);

  if (!Number.isFinite(numero) || Math.abs(numero) > tope) {
    return null;
  }

  return Number(numero.toFixed(MAX_DECIMALES));
}
