import { aplicaBloqueoDeHora, edicionInvolucraHora, HORA_BLOQUEADA, rolSujetoABloqueoDeHora } from './schedule-lock.util';

describe('schedule-lock.util', () => {
  it('la hora bloqueada es medianoche', () => {
    expect(HORA_BLOQUEADA).toBe('00:00:00');
  });

  it.each([
    ['3', true],
    ['6', true],
    ['1', false],
    ['4', false],
    ['7', false],
    [undefined, false],
    [null, false],
  ])('rol %s sujeto a bloqueo: %s', (roleId, esperado) => {
    expect(rolSujetoABloqueoDeHora(roleId as any)).toBe(esperado);
  });

  it.each([
    ['3', true, true],
    ['6', true, true],
    ['3', false, false],
    ['6', null, false],
    ['1', true, false],
    [undefined, true, false],
  ])('rol %s con lock=%s aplica bloqueo: %s', (roleId, lock, esperado) => {
    expect(aplicaBloqueoDeHora(roleId as any, lock as any)).toBe(esperado);
  });

  it('una edicion involucra la hora si trae schedule o communityId', () => {
    expect(edicionInvolucraHora({ schedule: '10:00:00' })).toBe(true);
    expect(edicionInvolucraHora({ schedule: null })).toBe(true);
    expect(edicionInvolucraHora({ communityId: '5' })).toBe(true);
    expect(edicionInvolucraHora({})).toBe(false);
    expect(edicionInvolucraHora({ comment: 'x' } as any)).toBe(false);
  });
});
