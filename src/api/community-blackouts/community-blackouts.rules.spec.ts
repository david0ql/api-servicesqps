import {
  BlackoutLike,
  blackoutInterval,
  buildBlockedMessage,
  coversWholeDay,
  findBlockingBlackout,
  isUnspecifiedSchedule,
  normalizeDate,
  parseTimeToMinutes,
} from './community-blackouts.rules';

const b = (over: Partial<BlackoutLike>): BlackoutLike => ({
  id: '1',
  startDate: '2026-11-26',
  endDate: '2026-11-26',
  period: 'full_day',
  startTime: null,
  endTime: null,
  reason: null,
  ...over,
});

describe('community-blackouts rules', () => {
  describe('parseTimeToMinutes', () => {
    it.each([
      ['00:00', 0],
      ['00:00:00', 0],
      ['08:30', 510],
      ['12:00:00', 720],
      ['23:59:59', 1439],
      ['24:00', 1440],
      ['24:00:00', 1440],
      ['7:05', 425],
    ])('%s -> %i', (value, expected) => {
      expect(parseTimeToMinutes(value)).toBe(expected);
    });

    it.each([null, undefined, '', 'abc', '12:60', '10:00:61', '24:01', '25:00', '24:00:01'])(
      'rechaza %p',
      (value) => {
        expect(parseTimeToMinutes(value as any)).toBeNull();
      },
    );
  });

  describe('isUnspecifiedSchedule', () => {
    it.each([null, undefined, '', '  ', '00:00', '00:00:00'])('%p es sin hora', (v) => {
      expect(isUnspecifiedSchedule(v as any)).toBe(true);
    });
    it.each(['00:01', '08:00:00', '12:00'])('%p tiene hora', (v) => {
      expect(isUnspecifiedSchedule(v)).toBe(false);
    });
  });

  describe('blackoutInterval', () => {
    it('full_day, am y pm', () => {
      expect(blackoutInterval(b({ period: 'full_day' }))).toEqual({ start: 0, end: 1440 });
      expect(blackoutInterval(b({ period: 'am' }))).toEqual({ start: 0, end: 720 });
      expect(blackoutInterval(b({ period: 'pm' }))).toEqual({ start: 720, end: 1440 });
    });
    it('custom valido', () => {
      expect(blackoutInterval(b({ period: 'custom', startTime: '08:00:00', endTime: '14:30:00' })))
        .toEqual({ start: 480, end: 870 });
    });
    it('custom invalido o vacio no bloquea', () => {
      expect(blackoutInterval(b({ period: 'custom', startTime: '14:00', endTime: '08:00' }))).toBeNull();
      expect(blackoutInterval(b({ period: 'custom', startTime: '08:00', endTime: '08:00' }))).toBeNull();
      expect(blackoutInterval(b({ period: 'custom' }))).toBeNull();
      expect(blackoutInterval(b({ period: 'otro' as any }))).toBeNull();
    });
  });

  describe('coversWholeDay', () => {
    it.each([
      [[{ start: 0, end: 1440 }], true],
      [[{ start: 720, end: 1440 }, { start: 0, end: 720 }], true],
      [[{ start: 0, end: 600 }, { start: 500, end: 1440 }], true],
      [[{ start: 0, end: 720 }], false],
      [[{ start: 0, end: 600 }, { start: 601, end: 1440 }], false],
      [[{ start: 1, end: 1440 }], false],
      [[], false],
    ])('%j -> %p', (intervals, expected) => {
      expect(coversWholeDay(intervals)).toBe(expected);
    });
  });

  describe('findBlockingBlackout', () => {
    it('sin bloqueos o de otra fecha: permitido', () => {
      expect(findBlockingBlackout([], '2026-11-26', '09:00')).toBeNull();
      expect(findBlockingBlackout([b({})], '2026-11-27', '09:00')).toBeNull();
      expect(findBlockingBlackout([b({})], '2026-11-25', null)).toBeNull();
    });

    describe('full_day', () => {
      it.each([null, '', '00:00:00', '08:00:00', '12:00:00', '23:59:00'])('bloquea schedule %p', (s) => {
        expect(findBlockingBlackout([b({})], '2026-11-26', s as any)).not.toBeNull();
      });
    });

    describe('rango de fechas', () => {
      const range = b({ startDate: '2026-12-24', endDate: '2026-12-26' });
      it.each(['2026-12-24', '2026-12-25', '2026-12-26'])('bloquea %s (extremos inclusive)', (d) => {
        expect(findBlockingBlackout([range], d, '10:00')).toBe(range);
      });
      it.each(['2026-12-23', '2026-12-27'])('permite %s', (d) => {
        expect(findBlockingBlackout([range], d, '10:00')).toBeNull();
      });
      it('aplica la franja a cada dia del rango', () => {
        const amRange = b({ period: 'am', startDate: '2026-12-24', endDate: '2026-12-26' });
        expect(findBlockingBlackout([amRange], '2026-12-25', '09:00')).toBe(amRange);
        expect(findBlockingBlackout([amRange], '2026-12-25', '15:00')).toBeNull();
      });
    });

    describe('am (00:00-12:00)', () => {
      const am = b({ period: 'am' });
      it.each(['00:01', '08:00:00', '11:59:59'])('bloquea %s', (s) => {
        expect(findBlockingBlackout([am], '2026-11-26', s)).toBe(am);
      });
      it.each(['12:00:00', '15:00', '23:00'])('permite %s', (s) => {
        expect(findBlockingBlackout([am], '2026-11-26', s)).toBeNull();
      });
      it.each([null, '00:00:00', ''])('sin hora (%p) se permite: puede hacerse en la tarde', (s) => {
        expect(findBlockingBlackout([am], '2026-11-26', s as any)).toBeNull();
      });
    });

    describe('pm (12:00-24:00)', () => {
      const pm = b({ period: 'pm' });
      it.each(['12:00:00', '15:30', '23:59'])('bloquea %s', (s) => {
        expect(findBlockingBlackout([pm], '2026-11-26', s)).toBe(pm);
      });
      it.each(['08:00', '11:59:59'])('permite %s', (s) => {
        expect(findBlockingBlackout([pm], '2026-11-26', s)).toBeNull();
      });
      it('sin hora se permite', () => {
        expect(findBlockingBlackout([pm], '2026-11-26', '00:00:00')).toBeNull();
      });
    });

    describe('custom', () => {
      const custom = b({ period: 'custom', startTime: '08:00:00', endTime: '14:00:00' });
      it.each(['08:00', '10:00', '13:59:59'])('bloquea %s', (s) => {
        expect(findBlockingBlackout([custom], '2026-11-26', s)).toBe(custom);
      });
      it.each(['07:59', '14:00', '18:00'])('permite %s (fin exclusivo)', (s) => {
        expect(findBlockingBlackout([custom], '2026-11-26', s)).toBeNull();
      });
      it('sin hora se permite', () => {
        expect(findBlockingBlackout([custom], '2026-11-26', null)).toBeNull();
      });
      it('custom 00:00-24:00 equivale a dia completo, tambien sin hora', () => {
        const whole = b({ period: 'custom', startTime: '00:00', endTime: '24:00' });
        expect(findBlockingBlackout([whole], '2026-11-26', null)).toBe(whole);
        expect(findBlockingBlackout([whole], '2026-11-26', '23:59')).toBe(whole);
      });
    });

    describe('combinaciones del mismo dia', () => {
      it('AM + PM juntos bloquean tambien un servicio sin hora', () => {
        const am = b({ id: 'a', period: 'am' });
        const pm = b({ id: 'p', period: 'pm' });
        expect(findBlockingBlackout([pm, am], '2026-11-26', null)).not.toBeNull();
        expect(findBlockingBlackout([am, pm], '2026-11-26', '09:00')).toBe(am);
        expect(findBlockingBlackout([am, pm], '2026-11-26', '13:00')).toBe(pm);
      });
      it('sin hora reporta preferentemente el de dia completo', () => {
        const am = b({ id: 'a', period: 'am', reason: 'Medio dia' });
        const full = b({ id: 'f', period: 'full_day', reason: 'Thanksgiving' });
        expect(findBlockingBlackout([am, full], '2026-11-26', null)).toBe(full);
      });
      it('rango de varios dias + bloqueo puntual', () => {
        const range = b({ id: 'r', period: 'pm', startDate: '2026-11-20', endDate: '2026-11-30' });
        const single = b({ id: 's', period: 'am', startDate: '2026-11-26', endDate: '2026-11-26' });
        expect(findBlockingBlackout([range, single], '2026-11-26', null)).not.toBeNull();
        expect(findBlockingBlackout([range, single], '2026-11-25', null)).toBeNull();
        expect(findBlockingBlackout([range, single], '2026-11-25', '09:00')).toBeNull();
      });
    });

    it('schedule invalido no bloquea en franjas parciales', () => {
      expect(findBlockingBlackout([b({ period: 'am' })], '2026-11-26', 'abc')).toBeNull();
    });
  });

  describe('buildBlockedMessage', () => {
    it('dia completo con motivo', () => {
      expect(buildBlockedMessage('Oak Park', '2026-11-26', b({ reason: 'Thanksgiving' })))
        .toBe('La comunidad Oak Park no trabaja el 2026-11-26 (Thanksgiving)');
    });
    it('dia completo sin motivo', () => {
      expect(buildBlockedMessage('Oak Park', '2026-11-26', b({ reason: '  ' })))
        .toBe('La comunidad Oak Park no trabaja el 2026-11-26');
    });
    it('franjas parciales incluyen el horario', () => {
      expect(buildBlockedMessage('Oak', '2026-11-26', b({ period: 'am' })))
        .toBe('La comunidad Oak no trabaja el 2026-11-26 de 00:00 a 12:00');
      expect(buildBlockedMessage('Oak', '2026-11-26', b({ period: 'pm', reason: 'Black Friday' })))
        .toBe('La comunidad Oak no trabaja el 2026-11-26 de 12:00 a 24:00 (Black Friday)');
      expect(buildBlockedMessage('Oak', '2026-11-26', b({ period: 'custom', startTime: '08:00:00', endTime: '14:30:00' })))
        .toBe('La comunidad Oak no trabaja el 2026-11-26 de 08:00 a 14:30');
    });
    it('sin nombre de comunidad', () => {
      expect(buildBlockedMessage(null, '2026-11-26', b({})))
        .toBe('La comunidad seleccionada no trabaja el 2026-11-26');
    });
  });

  describe('normalizeDate', () => {
    it.each([
      ['2026-11-26', '2026-11-26'],
      ['2026-11-26T05:00:00.000Z', '2026-11-26'],
      [null, null],
      ['', null],
      ['26/11/2026', null],
    ])('%p -> %p', (input, expected) => {
      expect(normalizeDate(input as any)).toBe(expected);
    });
  });
});
