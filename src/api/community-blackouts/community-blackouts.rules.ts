import type { BlackoutPeriod } from '../../entities/community_blackouts.entity';

/**
 * Reglas puras (sin base de datos) para decidir si un servicio cae en un
 * horario fuera de servicio de su comunidad.
 *
 * Regla del horario del servicio (`schedule`):
 *  - Con hora especifica (cualquier valor distinto de vacio / 00:00): se
 *    bloquea si esa hora cae dentro de alguna franja bloqueada del dia.
 *    Las franjas son semiabiertas [inicio, fin): AM = [00:00, 12:00),
 *    PM = [12:00, 24:00). Un servicio a las 12:00 cae en PM, no en AM.
 *  - Sin hora especifica (null, '' o 00:00, que es como la app guarda "sin
 *    hora"): se bloquea solo si las franjas del dia, juntas, cubren el dia
 *    completo (un full_day, o AM + PM, o rangos que sumen 00:00-24:00). Si
 *    queda alguna franja libre, el servicio se puede hacer en esa franja.
 */

export const MINUTES_PER_DAY = 24 * 60;
export const NOON = 12 * 60;

export interface BlackoutLike {
  id?: string;
  communityId?: string;
  startDate: string;
  endDate: string;
  period: BlackoutPeriod;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
}

export interface Interval {
  start: number;
  end: number;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** 'HH:mm' o 'HH:mm:ss' -> minutos desde medianoche. null si no es valida.
 *  Acepta 24:00 como fin de dia. */
export function parseTimeToMinutes(value?: string | null): number | null {
  if (value === null || value === undefined) return null;
  const match = TIME_RE.exec(String(value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (minutes > 59 || seconds > 59) return null;
  const total = hours * 60 + minutes;
  if (total > MINUTES_PER_DAY || (total === MINUTES_PER_DAY && seconds > 0)) return null;
  return total;
}

export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Un schedule vacio o 00:00 significa "sin hora especifica". */
export function isUnspecifiedSchedule(schedule?: string | null): boolean {
  if (schedule === null || schedule === undefined || String(schedule).trim() === '') return true;
  return parseTimeToMinutes(schedule) === 0;
}

/** Franja horaria que bloquea el registro, en minutos [start, end). */
export function blackoutInterval(blackout: BlackoutLike): Interval | null {
  switch (blackout.period) {
    case 'full_day':
      return { start: 0, end: MINUTES_PER_DAY };
    case 'am':
      return { start: 0, end: NOON };
    case 'pm':
      return { start: NOON, end: MINUTES_PER_DAY };
    case 'custom': {
      const start = parseTimeToMinutes(blackout.startTime);
      const end = parseTimeToMinutes(blackout.endTime);
      if (start === null || end === null || end <= start) return null;
      return { start, end };
    }
    default:
      return null;
  }
}

/** Fechas en YYYY-MM-DD se comparan bien como texto. */
export function coversDate(blackout: BlackoutLike, date: string): boolean {
  return blackout.startDate <= date && date <= blackout.endDate;
}

/** True si la union de las franjas cubre el dia completo. */
export function coversWholeDay(intervals: Interval[]): boolean {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let reached = 0;
  for (const interval of sorted) {
    if (interval.start > reached) return false;
    reached = Math.max(reached, interval.end);
    if (reached >= MINUTES_PER_DAY) return true;
  }
  return reached >= MINUTES_PER_DAY;
}

/**
 * Devuelve el bloqueo que impide un servicio en `date` a la hora `schedule`,
 * o null si el servicio esta permitido. Los bloqueos de otras fechas se
 * ignoran, asi que se puede pasar la lista completa de la comunidad.
 */
export function findBlockingBlackout<T extends BlackoutLike>(
  blackouts: T[],
  date: string,
  schedule?: string | null,
): T | null {
  const sameDay = blackouts
    .filter((b) => coversDate(b, date))
    .map((b) => ({ blackout: b, interval: blackoutInterval(b) }))
    .filter((x): x is { blackout: T; interval: Interval } => x.interval !== null);

  if (!sameDay.length) return null;

  if (isUnspecifiedSchedule(schedule)) {
    if (!coversWholeDay(sameDay.map((x) => x.interval))) return null;
    // Se reporta el de dia completo si existe; si no, el primero (p.ej. AM).
    const full = sameDay.find((x) => x.interval.start === 0 && x.interval.end === MINUTES_PER_DAY);
    return (full ?? sameDay[0]).blackout;
  }

  const minutes = parseTimeToMinutes(schedule);
  if (minutes === null) return null;

  const hit = sameDay.find((x) => x.interval.start <= minutes && minutes < x.interval.end);
  return hit ? hit.blackout : null;
}

/** Texto de la franja para mensajes: '' en dia completo, ' de 00:00 a 12:00' en otro caso. */
export function describeWindow(blackout: BlackoutLike): string {
  const interval = blackoutInterval(blackout);
  if (!interval || (interval.start === 0 && interval.end === MINUTES_PER_DAY)) return '';
  return ` de ${minutesToHHmm(interval.start)} a ${minutesToHHmm(interval.end)}`;
}

/** "La comunidad X no trabaja el 2026-11-26 (Thanksgiving)". */
export function buildBlockedMessage(
  communityName: string | null | undefined,
  date: string,
  blackout: BlackoutLike,
): string {
  const name = communityName?.trim() || 'seleccionada';
  const reason = blackout.reason?.trim() ? ` (${blackout.reason.trim()})` : '';
  return `La comunidad ${name} no trabaja el ${date}${describeWindow(blackout)}${reason}`;
}

/** Normaliza fecha a YYYY-MM-DD (acepta ISO con hora, como manda el DatePicker). */
export function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim());
  return match ? match[1] : null;
}
