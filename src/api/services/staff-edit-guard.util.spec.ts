import { ForbiddenException } from '@nestjs/common';
import { sanitizeStaffCreate, sanitizeStaffUpdate } from './staff-edit-guard.util';

describe('staff-edit-guard', () => {
  const dto = { date: '2026-11-18', userId: '99', statusId: '2', comment: 'x' };

  it.each(['3', '6'])('rol %s: ignora userId/statusId si la fecha no cambia', (role) => {
    const out = sanitizeStaffUpdate(role, dto, '2026-11-18');
    expect(out).toEqual({ date: '2026-11-18', comment: 'x' });
  });

  it.each(['3', '6'])('rol %s: rechaza cambiar la fecha', (role) => {
    expect(() => sanitizeStaffUpdate(role, { ...dto, date: '2026-11-19' }, '2026-11-18')).toThrow(ForbiddenException);
  });

  it('acepta la fecha guardada como Date', () => {
    expect(sanitizeStaffUpdate('6', dto, new Date('2026-11-18T00:00:00Z'))).not.toHaveProperty('userId');
  });

  it.each(['1', '9', '4', '7', undefined])('rol %s: no toca nada', (role) => {
    expect(sanitizeStaffUpdate(role as any, { ...dto, date: '2026-11-25' }, '2026-11-18')).toEqual({ ...dto, date: '2026-11-25' });
  });

  it('crear como supervisor/manager: sin cleaner y en Created', () => {
    expect(sanitizeStaffCreate('6', dto)).toMatchObject({ userId: null, statusId: '1' });
    expect(sanitizeStaffCreate('3', dto)).toMatchObject({ userId: null, statusId: '1' });
    expect(sanitizeStaffCreate('1', dto)).toMatchObject({ userId: '99', statusId: '2' });
  });
});
