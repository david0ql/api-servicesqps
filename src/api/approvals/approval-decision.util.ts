import { isAdminPapel } from '../../constants/roles';

export const APPROVAL_TOKEN_HEADER = 'x-approval-token';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type ApprovalInterception = 'pass' | 'queue' | 'replay';

export interface ApprovalDecisionInput {
  method: string;
  skip: boolean;
  user?: { id?: string; roleId?: string | null } | null;
  approvalToken?: string | string[] | null;
}

/**
 * Qué hace el interceptor con la petición:
 *  - pass: sigue normal (lecturas, endpoints exentos, usuarios que no son Admin Papel).
 *  - replay: es la re-ejecución de una solicitud aprobada (trae x-approval-token).
 *  - queue: se guarda como solicitud de aprobación y NO se ejecuta.
 */
export const decideApprovalInterception = (input: ApprovalDecisionInput): ApprovalInterception => {
  if (!MUTATING_METHODS.has(String(input.method).toUpperCase())) return 'pass';
  if (input.skip) return 'pass';
  if (!input.user?.id || !isAdminPapel(input.user.roleId)) return 'pass';

  const token = Array.isArray(input.approvalToken) ? input.approvalToken[0] : input.approvalToken;
  if (token && String(token).trim()) return 'replay';

  return 'queue';
};
