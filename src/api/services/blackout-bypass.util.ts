import { ROLE_SUPER_ADMIN } from '../../constants/roles';

/** Los feriados/días fuera de servicio no aplican al super admin ni a una
 *  petición que un admin ya aprobó (re-ejecución con x-approval-token). */
export const canSkipBlackouts = (user?: { roleId?: string | null } | null, approvedReplay?: boolean): boolean =>
  approvedReplay === true || String(user?.roleId ?? '') === ROLE_SUPER_ADMIN;
