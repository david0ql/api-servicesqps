/**
 * Ids de rol que el código compara a mano. Centralizados aquí para que un rol
 * nuevo con permisos de administrador (Admin Papel) no quede fuera de los
 * chequeos que antes eran `roleId === '1'`.
 */
export const ROLE_SUPER_ADMIN = '1';
export const ROLE_MANAGER = '3';
export const ROLE_CLEANER = '4';
export const ROLE_CHEO = '5';
export const ROLE_SUPERVISOR = '6';
export const ROLE_QA = '7';
export const ROLE_VENDEDOR = '8';
/** Administrador "de papel": ve todo como admin, pero cada cambio que haga
 *  queda como solicitud de aprobación para los super admins (rol 1). */
export const ROLE_ADMIN_PAPEL = '9';
export const ROLE_ADMIN_PAPEL_NAME = 'Admin Papel';

export const ADMIN_LIKE_ROLE_IDS: readonly string[] = [ROLE_SUPER_ADMIN, ROLE_ADMIN_PAPEL];

const normalize = (roleId: unknown): string => (roleId === null || roleId === undefined ? '' : String(roleId));

/** Admin real o Admin Papel: para lectura y permisos de UI/negocio. */
export const isAdminLike = (roleId: unknown): boolean => ADMIN_LIKE_ROLE_IDS.includes(normalize(roleId));

export const isAdminPapel = (roleId: unknown): boolean => normalize(roleId) === ROLE_ADMIN_PAPEL;
