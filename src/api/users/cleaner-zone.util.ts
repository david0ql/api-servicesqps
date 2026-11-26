import moment from 'moment-timezone';

/**
 * Zona de trabajo de las cleaners (rol 4).
 *
 * Una cleaner puede trabajar en una comunidad si:
 *  - la comunidad esta seleccionada explicitamente, o
 *  - la compania duena de la comunidad esta seleccionada, o
 *  - las coordenadas de la comunidad caen dentro de alguno de sus poligonos
 *    (geocerca libre dibujada por el admin).
 * Las comunidades sin coordenadas solo cuentan por seleccion explicita
 * (comunidad o compania).
 *
 * Todo aqui es puro (sin Nest ni TypeORM) para poder probarlo aislado.
 */

export const CLEANER_ROLE_ID = '4';
export const DEFAULT_CLEANER_ZONE_ENFORCE_FROM = '2026-12-16';
export const CLEANER_ZONE_TIMEZONE = 'America/New_York';

/** Posicion GeoJSON: [longitud, latitud]. */
export type GeoPosition = [number, number];

export interface ZonePolygonGeometry {
  type: 'Polygon';
  coordinates: GeoPosition[][];
}

export interface ZoneMultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: GeoPosition[][][];
}

export interface ZoneFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: ZonePolygonGeometry | ZoneMultiPolygonGeometry;
}

export interface ZoneFeatureCollection {
  type: 'FeatureCollection';
  features: ZoneFeature[];
}

export interface CleanerWorkZone {
  workCommunityIds?: string[] | null;
  workCompanyIds?: string[] | null;
  workZones?: ZoneFeatureCollection | null;
}

export interface CommunityLocation {
  id: string;
  companyId?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

export class InvalidWorkZoneError extends Error {}

const MAX_FEATURES = 50;
const MAX_VERTICES_PER_RING = 5000;

/**
 * Ray casting clasico sobre un anillo [lng, lat]. Da igual si el anillo viene
 * cerrado (primer punto repetido al final) o no.
 */
export function pointInRing(point: GeoPosition, ring: GeoPosition[]): boolean {
  const [x, y] = point;
  let inside = false;
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Poligono GeoJSON: primer anillo = borde exterior, el resto = huecos. */
export function pointInPolygon(point: GeoPosition, rings: GeoPosition[][]): boolean {
  if (!rings?.length || !pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}

export function pointInGeometry(
  point: GeoPosition,
  geometry: ZonePolygonGeometry | ZoneMultiPolygonGeometry | null | undefined,
): boolean {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  }
  return false;
}

export function pointInZones(point: GeoPosition, zones: ZoneFeatureCollection | null | undefined): boolean {
  return Boolean(zones?.features?.some((feature) => pointInGeometry(point, feature?.geometry)));
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export function communityPosition(community: CommunityLocation): GeoPosition | null {
  const lat = toNumber(community.latitude);
  const lng = toNumber(community.longitude);
  if (lat === null || lng === null) return null;
  // 0,0 es el valor "vacio" que a veces queda en formularios: no es una ubicacion real.
  if (lat === 0 && lng === 0) return null;
  return [lng, lat];
}

const idSet = (ids: Array<string | number> | null | undefined) =>
  new Set((ids ?? []).map((id) => String(id)));

export function hasWorkZone(zone: CleanerWorkZone | null | undefined): boolean {
  if (!zone) return false;
  return Boolean(
    (zone.workCommunityIds?.length ?? 0) > 0
    || (zone.workCompanyIds?.length ?? 0) > 0
    || (zone.workZones?.features?.length ?? 0) > 0,
  );
}

export function isCleanerEligibleForCommunity(
  zone: CleanerWorkZone | null | undefined,
  community: CommunityLocation,
): boolean {
  if (!zone || !community) return false;
  if (idSet(zone.workCommunityIds).has(String(community.id))) return true;
  if (community.companyId && idSet(zone.workCompanyIds).has(String(community.companyId))) return true;
  const position = communityPosition(community);
  if (!position) return false;
  return pointInZones(position, zone.workZones);
}

/** Fecha (YYYY-MM-DD) en Nueva York para un instante dado. */
export function todayInZoneTimezone(now: Date = new Date()): string {
  return moment(now).tz(CLEANER_ZONE_TIMEZONE).format('YYYY-MM-DD');
}

export function normalizeEnforceFrom(value: string | null | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : DEFAULT_CLEANER_ZONE_ENFORCE_FROM;
}

/**
 * Periodo de gracia: antes de `enforceFrom` (fecha de Nueva York) se muestran
 * todas las cleaners y no se valida nada. Desde ese dia, inclusive, solo las elegibles.
 */
export function isZoneEnforced(now: Date, enforceFrom: string | null | undefined): boolean {
  return todayInZoneTimezone(now) >= normalizeEnforceFrom(enforceFrom);
}

const isPosition = (value: unknown): value is GeoPosition =>
  Array.isArray(value)
  && value.length >= 2
  && typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180
  && typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;

const normalizeRing = (ring: unknown): GeoPosition[] => {
  if (!Array.isArray(ring)) throw new InvalidWorkZoneError('Cada anillo del poligono debe ser una lista de puntos.');
  if (ring.length > MAX_VERTICES_PER_RING) throw new InvalidWorkZoneError('El poligono tiene demasiados puntos.');
  const points = ring.map((p) => {
    if (!isPosition(p)) throw new InvalidWorkZoneError('Coordenada invalida en la geocerca (se espera [lng, lat]).');
    return [p[0], p[1]] as GeoPosition;
  });
  // GeoJSON exige el anillo cerrado.
  const first = points[0];
  const last = points[points.length - 1];
  if (first && (first[0] !== last[0] || first[1] !== last[1])) points.push([first[0], first[1]]);
  if (points.length < 4) throw new InvalidWorkZoneError('Cada poligono necesita al menos 3 puntos.');
  return points;
};

const normalizePolygon = (rings: unknown): GeoPosition[][] => {
  if (!Array.isArray(rings) || !rings.length) throw new InvalidWorkZoneError('Poligono vacio.');
  return rings.map(normalizeRing);
};

const normalizeGeometry = (geometry: any): ZonePolygonGeometry | ZoneMultiPolygonGeometry => {
  if (geometry?.type === 'Polygon') {
    return { type: 'Polygon', coordinates: normalizePolygon(geometry.coordinates) };
  }
  if (geometry?.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates)) throw new InvalidWorkZoneError('MultiPolygon invalido.');
    return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(normalizePolygon) };
  }
  throw new InvalidWorkZoneError('Solo se aceptan poligonos (Polygon / MultiPolygon).');
};

/**
 * Valida y limpia lo que manda la web. Acepta FeatureCollection, un Feature
 * suelto o una geometria. Devuelve null si no hay poligonos.
 */
export function normalizeWorkZones(input: unknown): ZoneFeatureCollection | null {
  if (input === null || input === undefined) return null;
  const value: any = typeof input === 'string' ? safeParse(input) : input;
  let rawFeatures: any[];
  if (value?.type === 'FeatureCollection') {
    rawFeatures = Array.isArray(value.features) ? value.features : [];
  } else if (value?.type === 'Feature') {
    rawFeatures = [value];
  } else if (value?.type === 'Polygon' || value?.type === 'MultiPolygon') {
    rawFeatures = [{ type: 'Feature', properties: {}, geometry: value }];
  } else {
    throw new InvalidWorkZoneError('La geocerca debe ser GeoJSON (FeatureCollection de poligonos).');
  }
  if (rawFeatures.length > MAX_FEATURES) throw new InvalidWorkZoneError(`Maximo ${MAX_FEATURES} poligonos por cleaner.`);
  const features: ZoneFeature[] = rawFeatures.map((feature) => ({
    type: 'Feature',
    properties: feature?.properties && typeof feature.properties === 'object' && !Array.isArray(feature.properties)
      ? pickProperties(feature.properties)
      : {},
    geometry: normalizeGeometry(feature?.geometry),
  }));
  return features.length ? { type: 'FeatureCollection', features } : null;
}

const pickProperties = (properties: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (typeof properties.name === 'string') out.name = properties.name.slice(0, 80);
  return out;
};

const safeParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidWorkZoneError('La geocerca no es JSON valido.');
  }
};

export function normalizeIdList(ids: Array<string | number> | null | undefined): string[] {
  return Array.from(idSet(ids)).filter((id) => /^\d+$/.test(id));
}
