/**
 * Genera la imagen PNG del mapa de un complex pegando los tiles de
 * OpenStreetMap y dibujando el pin encima.
 *
 * Por que hecho a mano y no con un servicio de mapa estatico: el unico
 * gratuito sin API key (staticmap.openstreetmap.de) esta caido, y los demas
 * (Google/Mapbox/Geoapify) piden llave y cobran. Los tiles de OSM ya se usan
 * en la web para el tracking, asi que no agregamos ninguna dependencia externa
 * nueva. Cada imagen se cachea, asi que se piden ~12 tiles UNA vez por complex.
 */
import { PNG } from 'pngjs';

const TILE = 256;
const UA = 'ServicesQPS/1.0 (+https://api.servicesqps.com)';
const ATRIBUCION = '(c) OpenStreetMap';

export interface OpcionesMapa {
  latitude: number;
  longitude: number;
  ancho?: number;
  alto?: number;
  zoom?: number;
}

const lonAX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latAY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

async function traerTile(z: number, x: number, y: number): Promise<PNG | null> {
  const max = 2 ** z;
  if (y < 0 || y >= max) return null;
  const xx = ((x % max) + max) % max; // el mundo da la vuelta en X

  try {
    const respuesta = await fetch(`https://tile.openstreetmap.org/${z}/${xx}/${y}.png`, {
      headers: { 'User-Agent': UA },
    });
    if (!respuesta.ok) return null;
    return PNG.sync.read(Buffer.from(await respuesta.arrayBuffer()));
  } catch {
    return null;
  }
}

function pintar(destino: PNG, x: number, y: number, [r, g, b, a]: number[]) {
  if (x < 0 || y < 0 || x >= destino.width || y >= destino.height) return;
  const i = (destino.width * y + x) << 2;
  if (a >= 255) {
    destino.data[i] = r; destino.data[i + 1] = g; destino.data[i + 2] = b; destino.data[i + 3] = 255;
    return;
  }
  const k = a / 255;
  destino.data[i] = Math.round(destino.data[i] * (1 - k) + r * k);
  destino.data[i + 1] = Math.round(destino.data[i + 1] * (1 - k) + g * k);
  destino.data[i + 2] = Math.round(destino.data[i + 2] * (1 - k) + b * k);
  destino.data[i + 3] = 255;
}

function circulo(destino: PNG, cx: number, cy: number, radio: number, color: number[]) {
  for (let y = -radio; y <= radio; y++) {
    for (let x = -radio; x <= radio; x++) {
      if (x * x + y * y <= radio * radio) pintar(destino, cx + x, cy + y, color);
    }
  }
}

/** El pin: gota roja con borde blanco, como el del selector en la web. */
function dibujarPin(destino: PNG, cx: number, cy: number) {
  const ROJO = [220, 38, 38, 255];
  const BLANCO = [255, 255, 255, 255];
  const SOMBRA = [0, 0, 0, 60];

  circulo(destino, cx, cy + 20, 7, SOMBRA);       // sombra en el piso
  for (let y = 0; y <= 20; y++) {                  // punta
    const ancho = Math.max(0, Math.round(6 * (1 - y / 20)));
    for (let x = -ancho; x <= ancho; x++) pintar(destino, cx + x, cy + y, y > 17 ? ROJO : BLANCO);
  }
  circulo(destino, cx, cy, 13, BLANCO);
  circulo(destino, cx, cy, 10, ROJO);
  circulo(destino, cx, cy, 4, BLANCO);
}

// Fuente 5x7 minima, solo con los caracteres de la atribucion.
const FUENTE: Record<string, string[]> = {
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  c: ['00000', '00000', '01110', '10001', '10000', '10001', '01110'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  n: ['00000', '00000', '10110', '11001', '10001', '10001', '10001'],
  p: ['00000', '00000', '11110', '10001', '11110', '10000', '10000'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  t: ['00100', '00100', '01110', '00100', '00100', '00101', '00010'],
};

/** OSM exige atribucion visible; la imagen viaja sola en la vista previa,
 *  asi que la lleva impresa. */
function dibujarAtribucion(destino: PNG, texto: string) {
  const escala = 2;
  const anchoTexto = texto.length * 6 * escala;
  const altoTexto = 7 * escala;
  const x0 = destino.width - anchoTexto - 8;
  const y0 = destino.height - altoTexto - 6;

  for (let y = y0 - 3; y < destino.height; y++) {
    for (let x = x0 - 5; x < destino.width; x++) pintar(destino, x, y, [255, 255, 255, 190]);
  }

  let cursor = x0;
  for (const caracter of texto) {
    const glifo = FUENTE[caracter];
    if (glifo) {
      for (let fila = 0; fila < glifo.length; fila++) {
        for (let col = 0; col < 5; col++) {
          if (glifo[fila][col] !== '1') continue;
          for (let dy = 0; dy < escala; dy++) {
            for (let dx = 0; dx < escala; dx++) {
              pintar(destino, cursor + col * escala + dx, y0 + fila * escala + dy, [60, 60, 60, 255]);
            }
          }
        }
      }
    }
    cursor += 6 * escala;
  }
}

export async function generarMapaEstatico(opciones: OpcionesMapa): Promise<Buffer> {
  const ancho = opciones.ancho ?? 640;
  const alto = opciones.alto ?? 336; // ~1.9:1, la proporcion que usan las vistas previas
  const zoom = opciones.zoom ?? 16;

  const centroX = lonAX(opciones.longitude, zoom) * TILE;
  const centroY = latAY(opciones.latitude, zoom) * TILE;
  const izquierda = centroX - ancho / 2;
  const arriba = centroY - alto / 2;

  const lienzo = new PNG({ width: ancho, height: alto });
  lienzo.data.fill(226); // gris claro por si algun tile no llega

  const desdeX = Math.floor(izquierda / TILE);
  const hastaX = Math.floor((izquierda + ancho - 1) / TILE);
  const desdeY = Math.floor(arriba / TILE);
  const hastaY = Math.floor((arriba + alto - 1) / TILE);

  const pedidos: Promise<{ tile: PNG | null; tx: number; ty: number }>[] = [];
  for (let ty = desdeY; ty <= hastaY; ty++) {
    for (let tx = desdeX; tx <= hastaX; tx++) {
      pedidos.push(traerTile(zoom, tx, ty).then((tile) => ({ tile, tx, ty })));
    }
  }

  for (const { tile, tx, ty } of await Promise.all(pedidos)) {
    if (!tile) continue;
    const offsetX = Math.round(tx * TILE - izquierda);
    const offsetY = Math.round(ty * TILE - arriba);
    for (let y = 0; y < tile.height; y++) {
      const destinoY = offsetY + y;
      if (destinoY < 0 || destinoY >= alto) continue;
      for (let x = 0; x < tile.width; x++) {
        const destinoX = offsetX + x;
        if (destinoX < 0 || destinoX >= ancho) continue;
        const o = (tile.width * y + x) << 2;
        const d = (ancho * destinoY + destinoX) << 2;
        lienzo.data[d] = tile.data[o];
        lienzo.data[d + 1] = tile.data[o + 1];
        lienzo.data[d + 2] = tile.data[o + 2];
        lienzo.data[d + 3] = 255;
      }
    }
  }

  dibujarPin(lienzo, Math.round(ancho / 2), Math.round(alto / 2));
  dibujarAtribucion(lienzo, ATRIBUCION);

  return PNG.sync.write(lienzo);
}
