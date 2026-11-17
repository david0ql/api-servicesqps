import { ForbiddenException } from '@nestjs/common';

/**
 * Restricciones para managers (3) y supervisores (6) al crear/editar servicios.
 *
 * - No pueden cambiar la fecha: mover un servicio desordena el calendario de las cleaners.
 * - No asignan cleaner ni cambian el estado: la app reenvía al editar el userId/statusId
 *   que tenía cuando cargó la lista; si ese dato estaba viejo, revertía una aceptación
 *   o reasignaba a la cleaner. El API ignora esos campos para estos roles.
 */
export const STAFF_ROLE_IDS = new Set(['3', '6']);

export const isStaffRole = (roleId?: string | null): boolean =>
  Boolean(roleId) && STAFF_ROLE_IDS.has(String(roleId));

export const STAFF_DATE_CHANGE_MESSAGE =
  'Los supervisores y managers no pueden cambiar la fecha del servicio. Pide a un administrador que lo reprograme.';

const sameDate = (a?: string | Date | null, b?: string | Date | null): boolean => {
  const norm = (v?: string | Date | null) => {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  };
  return norm(a) === norm(b);
};

/** Edición: quita userId/statusId y rechaza cambios de fecha (lanza 403). */
export function sanitizeStaffUpdate<T extends { userId?: any; statusId?: any; date?: any }>(
  roleId: string | null | undefined,
  dto: T,
  existingDate: string | Date | null | undefined,
): T {
  if (!isStaffRole(roleId)) return dto;
  if (typeof dto.date !== 'undefined' && dto.date !== null && !sameDate(dto.date, existingDate)) {
    throw new ForbiddenException(STAFF_DATE_CHANGE_MESSAGE);
  }
  const { userId: _userId, statusId: _statusId, ...rest } = dto;
  return rest as T;
}

/** Creación: el servicio queda siempre sin cleaner y en estado Created (1). */
export function sanitizeStaffCreate<T extends { userId?: any; statusId?: any }>(
  roleId: string | null | undefined,
  dto: T,
): T {
  if (!isStaffRole(roleId)) return dto;
  return { ...dto, userId: null, statusId: '1' };
}
