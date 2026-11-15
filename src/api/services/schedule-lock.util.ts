/**
 * Comunidades con lockScheduleForStaff: managers (rol 3) y supervisores
 * (rol 6) no eligen hora, el servicio queda a las 00:00. Admins y procesos
 * internos sin usuario (p.ej. servicios recurrentes) no se ven afectados.
 */
export const HORA_BLOQUEADA = '00:00:00';

const ROLES_CON_HORA_BLOQUEABLE = new Set(['3', '6']);

export function rolSujetoABloqueoDeHora(roleId?: string | null): boolean {
  return Boolean(roleId) && ROLES_CON_HORA_BLOQUEABLE.has(String(roleId));
}

export function aplicaBloqueoDeHora(roleId: string | null | undefined, lockScheduleForStaff?: boolean | null): boolean {
  return rolSujetoABloqueoDeHora(roleId) && Boolean(lockScheduleForStaff);
}

/**
 * En una edicion solo se fuerza la hora si el cambio la involucra (hora o
 * comunidad), para no pisar la hora que un admin haya puesto cuando el staff
 * edita otra cosa (comentario, estado, cleaner...).
 */
export function edicionInvolucraHora(dto: { schedule?: unknown; communityId?: unknown }): boolean {
  return typeof dto.schedule !== 'undefined' || typeof dto.communityId !== 'undefined';
}
