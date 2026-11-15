import type { PendingChangeStatus } from '../../entities/pending_changes.entity';

/** Textos de SMS del flujo de aprobación (en español, prefijo "QPS:"). */

export interface ShortRequest {
  code: string;
  summary: string;
}

export const requesterLabel = (name?: string | null): string => {
  const clean = (name ?? '').trim() || 'Admin Papel';
  return /papel/i.test(clean) ? clean : `${clean} (Admin Papel)`;
};

const withComment = (comment?: string | null) => (comment?.trim() ? ` Comentario: ${comment.trim()}` : '');

const shortSummary = (summary: string, max = 60) => (summary.length > max ? `${summary.slice(0, max - 3)}...` : summary);

export const listCodes = (pending: ShortRequest[]) =>
  pending.map((p) => `${p.code} (${shortSummary(p.summary, 40)})`).join(', ');

export const msgNewRequest = (requesterName: string | null | undefined, req: ShortRequest) =>
  `QPS: ${requesterLabel(requesterName)} quiere ${req.summary}. `
  + `Responde SI ${req.code} para aprobar o NO ${req.code} <comentario> para rechazar.`;

export const statusVerb = (status: PendingChangeStatus): string => {
  switch (status) {
    case 'approved':
    case 'executed':
    case 'failed':
      return 'aprobada';
    case 'rejected':
      return 'rechazada';
    case 'expired':
      return 'expirada';
    default:
      return 'pendiente';
  }
};

export const msgAlreadyDecided = (code: string, status: PendingChangeStatus, deciderName?: string | null) => {
  if (status === 'expired') return `QPS: La solicitud ${code} ya expiró sin respuesta.`;
  const by = deciderName ? ` por ${deciderName}` : '';
  return `QPS: La solicitud ${code} ya fue ${statusVerb(status)}${by}.`;
};

export const msgNotUnderstood = (pending: ShortRequest[]) =>
  'QPS: No entendí tu respuesta. Escribe SI <código> para aprobar o NO <código> <comentario> para rechazar.'
  + (pending.length ? ` Pendientes: ${listCodes(pending)}.` : ' No hay solicitudes pendientes.');

export const msgNoPending = () => 'QPS: No hay solicitudes pendientes de aprobación.';

export const msgAmbiguous = (pending: ShortRequest[]) =>
  `QPS: Hay ${pending.length} solicitudes pendientes: ${listCodes(pending)}. `
  + 'Responde SI <código> o NO <código> <comentario>.';

export const msgCodeNotFound = (code: string, pending: ShortRequest[]) =>
  `QPS: No encontré la solicitud ${code}.`
  + (pending.length ? ` Pendientes: ${listCodes(pending)}.` : ' No hay solicitudes pendientes.');

export interface DecisionResult extends ShortRequest {
  status: PendingChangeStatus;
  deciderName: string;
  comment?: string | null;
  error?: string | null;
}

/** Para el Admin Papel que hizo la solicitud. */
export const msgResultForRequester = (r: DecisionResult) => {
  switch (r.status) {
    case 'executed':
      return `QPS: Tu solicitud ${r.code} (${r.summary}) fue aprobada por ${r.deciderName} y ya se aplicó.${withComment(r.comment)}`;
    case 'failed':
      return `QPS: Tu solicitud ${r.code} (${r.summary}) fue aprobada por ${r.deciderName} pero falló al aplicarse: ${r.error ?? 'error desconocido'}.${withComment(r.comment)}`;
    case 'rejected':
      return `QPS: Tu solicitud ${r.code} (${r.summary}) fue rechazada por ${r.deciderName}.${withComment(r.comment)}`;
    default:
      return `QPS: Tu solicitud ${r.code} está ${statusVerb(r.status)}.`;
  }
};

/** Para los demás admins (no el que decidió). */
export const msgResultForOtherAdmins = (r: DecisionResult) => {
  const failed = r.status === 'failed' ? ` pero falló al aplicarse: ${r.error ?? 'error desconocido'}` : '';
  return `QPS: ${r.code} ${statusVerb(r.status)} por ${r.deciderName}${failed} (${shortSummary(r.summary, 80)}).${withComment(r.comment)}`;
};

/** Confirmación al admin que respondió por SMS. */
export const msgConfirmationForDecider = (r: DecisionResult) => {
  switch (r.status) {
    case 'executed':
      return `QPS: Listo, ${r.code} aprobada y aplicada.`;
    case 'failed':
      return `QPS: ${r.code} aprobada pero falló al aplicarse: ${r.error ?? 'error desconocido'}.`;
    case 'rejected':
      return `QPS: Listo, ${r.code} rechazada.`;
    default:
      return `QPS: ${r.code} ${statusVerb(r.status)}.`;
  }
};

export const msgExpired = (req: ShortRequest, hours: number) =>
  `QPS: Tu solicitud ${req.code} (${req.summary}) expiró: nadie la aprobó en ${hours} h. Vuelve a enviarla si aún aplica.`;
