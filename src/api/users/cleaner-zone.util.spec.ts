import {
  communityPosition,
  hasWorkZone,
  isCleanerEligibleForCommunity,
  isZoneEnforced,
  normalizeEnforceFrom,
  normalizeIdList,
  normalizeWorkZones,
  pointInPolygon,
  pointInRing,
  pointInZones,
  todayInZoneTimezone,
  ZoneFeatureCollection,
} from './cleaner-zone.util';

// Cuadrado alrededor de Orlando (lng -81.5..-81.3, lat 28.4..28.6).
const square: [number, number][] = [[-81.5, 28.4], [-81.3, 28.4], [-81.3, 28.6], [-81.5, 28.6], [-81.5, 28.4]];
// Forma de "L" (concava): falta el cuadrante superior derecho.
const lShape: [number, number][] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];

const fc = (...rings: [number, number][][]): ZoneFeatureCollection => ({
  type: 'FeatureCollection',
  features: rings.map((ring) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } })),
});

describe('pointInRing / pointInPolygon (ray casting)', () => {
  it('detecta puntos dentro y fuera de un cuadrado', () => {
    expect(pointInRing([-81.4, 28.5], square)).toBe(true);
    expect(pointInRing([-81.6, 28.5], square)).toBe(false);
    expect(pointInRing([-81.4, 28.7], square)).toBe(false);
  });

  it('funciona con poligonos concavos y anillos sin cerrar', () => {
    expect(pointInRing([0.5, 1.5], lShape)).toBe(true);
    expect(pointInRing([1.5, 0.5], lShape)).toBe(true);
    expect(pointInRing([1.5, 1.5], lShape)).toBe(false); // el hueco de la L
  });

  it('respeta los huecos (anillos interiores)', () => {
    const outer: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const hole: [number, number][] = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
    expect(pointInPolygon([2, 2], [outer, hole])).toBe(true);
    expect(pointInPolygon([5, 5], [outer, hole])).toBe(false);
  });

  it('anillos degenerados nunca contienen puntos', () => {
    expect(pointInRing([0, 0], [[0, 0], [1, 1]])).toBe(false);
    expect(pointInPolygon([0, 0], [])).toBe(false);
  });

  it('pointInZones revisa todos los poligonos y MultiPolygon', () => {
    const zones = fc(square, lShape);
    expect(pointInZones([1.5, 0.5], zones)).toBe(true);
    expect(pointInZones([-81.4, 28.5], zones)).toBe(true);
    expect(pointInZones([50, 50], zones)).toBe(false);
    expect(pointInZones([1, 1], null)).toBe(false);
    const multi: ZoneFeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[square], [lShape]] } }],
    };
    expect(pointInZones([0.5, 0.5], multi)).toBe(true);
  });
});

describe('isCleanerEligibleForCommunity', () => {
  const inside = { id: '10', companyId: '3', latitude: '28.5000000', longitude: '-81.4000000' };
  const outside = { id: '11', companyId: '4', latitude: '27.0', longitude: '-80.0' };
  const noCoords = { id: '12', companyId: '5', latitude: null, longitude: null };

  it('sin zona no es elegible para nada', () => {
    expect(isCleanerEligibleForCommunity({}, inside)).toBe(false);
    expect(isCleanerEligibleForCommunity(null, inside)).toBe(false);
  });

  it('por comunidad seleccionada (aunque no tenga coordenadas)', () => {
    expect(isCleanerEligibleForCommunity({ workCommunityIds: ['12'] }, noCoords)).toBe(true);
    expect(isCleanerEligibleForCommunity({ workCommunityIds: [12 as any] }, noCoords)).toBe(true);
    expect(isCleanerEligibleForCommunity({ workCommunityIds: ['99'] }, noCoords)).toBe(false);
  });

  it('por compania seleccionada', () => {
    expect(isCleanerEligibleForCommunity({ workCompanyIds: ['5'] }, noCoords)).toBe(true);
    expect(isCleanerEligibleForCommunity({ workCompanyIds: ['5'] }, { ...noCoords, companyId: null })).toBe(false);
  });

  it('por geocerca: solo si las coordenadas caen dentro', () => {
    const zone = { workZones: fc(square) };
    expect(isCleanerEligibleForCommunity(zone, inside)).toBe(true);
    expect(isCleanerEligibleForCommunity(zone, outside)).toBe(false);
    // Sin coordenadas solo cuenta la seleccion explicita.
    expect(isCleanerEligibleForCommunity(zone, noCoords)).toBe(false);
  });

  it('los modos se combinan', () => {
    const zone = { workZones: fc(square), workCompanyIds: ['4'] };
    expect(isCleanerEligibleForCommunity(zone, inside)).toBe(true);
    expect(isCleanerEligibleForCommunity(zone, outside)).toBe(true);
    expect(isCleanerEligibleForCommunity(zone, noCoords)).toBe(false);
  });

  it('0,0 no se toma como ubicacion', () => {
    expect(communityPosition({ id: '1', latitude: '0', longitude: '0' })).toBeNull();
    expect(communityPosition({ id: '1', latitude: '28.5', longitude: '-81.4' })).toEqual([-81.4, 28.5]);
  });

  it('hasWorkZone', () => {
    expect(hasWorkZone({ workCommunityIds: [], workCompanyIds: [], workZones: null })).toBe(false);
    expect(hasWorkZone({ workCompanyIds: ['1'] })).toBe(true);
    expect(hasWorkZone({ workZones: fc(square) })).toBe(true);
    expect(hasWorkZone({ workZones: { type: 'FeatureCollection', features: [] } })).toBe(false);
  });
});

describe('periodo de gracia (fecha de Nueva York)', () => {
  const from = '2026-12-16';

  it('jueves 26/11 al 15/12: no se aplica', () => {
    expect(isZoneEnforced(new Date('2026-11-26T15:00:00Z'), from)).toBe(false);
    expect(isZoneEnforced(new Date('2026-12-15T12:00:00Z'), from)).toBe(false);
  });

  it('usa la fecha de Nueva York, no la UTC', () => {
    // 16/12 03:00 UTC = 15/12 22:00 en Nueva York: todavia periodo de gracia.
    expect(todayInZoneTimezone(new Date('2026-12-16T03:00:00Z'))).toBe('2026-12-15');
    expect(isZoneEnforced(new Date('2026-12-16T03:00:00Z'), from)).toBe(false);
    // 16/12 05:00 UTC = 16/12 00:00 en Nueva York.
    expect(isZoneEnforced(new Date('2026-12-16T05:00:00Z'), from)).toBe(true);
  });

  it('desde el 16/12 en adelante se aplica', () => {
    expect(isZoneEnforced(new Date('2026-12-20T12:00:00Z'), from)).toBe(true);
    expect(isZoneEnforced(new Date('2027-03-01T12:00:00Z'), from)).toBe(true);
  });

  it('fecha configurable y default si viene vacia o mal formada', () => {
    expect(isZoneEnforced(new Date('2026-12-02T12:00:00Z'), '2026-12-01')).toBe(true);
    expect(normalizeEnforceFrom('')).toBe('2026-12-16');
    expect(normalizeEnforceFrom(undefined)).toBe('2026-12-16');
    expect(normalizeEnforceFrom('16/12/2026')).toBe('2026-12-16');
  });
});

describe('normalizeWorkZones', () => {
  it('null / undefined = sin poligonos', () => {
    expect(normalizeWorkZones(null)).toBeNull();
    expect(normalizeWorkZones({ type: 'FeatureCollection', features: [] })).toBeNull();
  });

  it('cierra los anillos y descarta propiedades extra', () => {
    const result = normalizeWorkZones({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { name: 'Norte', evil: 'x' }, geometry: { type: 'Polygon', coordinates: [lShape] } }],
    });
    const ring = (result.features[0].geometry as any).coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(result.features[0].properties).toEqual({ name: 'Norte' });
  });

  it('acepta un Polygon suelto o un string JSON', () => {
    expect(normalizeWorkZones({ type: 'Polygon', coordinates: [square] }).features).toHaveLength(1);
    expect(normalizeWorkZones(JSON.stringify(fc(square))).features).toHaveLength(1);
  });

  it('rechaza geometrias que no son poligonos o coordenadas invalidas', () => {
    expect(() => normalizeWorkZones({ type: 'Point', coordinates: [0, 0] })).toThrow();
    expect(() => normalizeWorkZones({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] })).toThrow();
    expect(() => normalizeWorkZones({ type: 'Polygon', coordinates: [[[0, 0], [1, 'a'], [2, 2]]] })).toThrow();
    expect(() => normalizeWorkZones({ type: 'Polygon', coordinates: [[[0, 0], [1, 200], [2, 2]]] })).toThrow();
    expect(() => normalizeWorkZones('{no json')).toThrow();
  });

  it('normalizeIdList deja ids numericos unicos como string', () => {
    expect(normalizeIdList(['1', 2 as any, '2', 'x', ''])).toEqual(['1', '2']);
  });
});
