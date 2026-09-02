import { buildMapLink } from './map-link.util';

describe('buildMapLink', () => {
  it('arma el link con coordenadas validas', () => {
    expect(buildMapLink(28.5383355, -81.3792365)).toBe('https://maps.google.com/?q=28.538335,-81.379237');
  });

  it('acepta los strings que devuelve TypeORM para columnas decimal', () => {
    expect(buildMapLink('28.5383355', '-81.3792365')).toBe('https://maps.google.com/?q=28.538335,-81.379237');
  });

  it('devuelve null cuando la comunidad no tiene coordenadas', () => {
    expect(buildMapLink(null, null)).toBeNull();
    expect(buildMapLink(undefined, undefined)).toBeNull();
    expect(buildMapLink('', '')).toBeNull();
    expect(buildMapLink(28.5383, null)).toBeNull();
  });

  it('descarta coordenadas fuera de rango o corruptas', () => {
    expect(buildMapLink(91, 0)).toBeNull();
    expect(buildMapLink(0, 181)).toBeNull();
    expect(buildMapLink('abc', 'def')).toBeNull();
  });

  it('trata 0,0 como "sin cargar" y no manda a null island', () => {
    expect(buildMapLink(0, 0)).toBeNull();
  });

  it('recorta a 6 decimales (mas que suficiente para un complex)', () => {
    expect(buildMapLink(28.53833549999, -81.37923649999)).toBe('https://maps.google.com/?q=28.538335,-81.379236');
  });

  it('mantiene el link corto para no gastar segmentos de SMS de mas', () => {
    expect(buildMapLink(28.5383355, -81.3792365)!.length).toBeLessThanOrEqual(50);
  });
});
