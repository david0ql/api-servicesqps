export type ApprovalDecision = 'approve' | 'reject';

export interface ParsedApprovalReply {
  decision: ApprovalDecision;
  /** Código en mayúsculas (ej. "A12") o null si el admin no lo escribió. */
  code: string | null;
  /** Comentario libre tal cual lo escribió (sin el SI/NO ni el código). */
  comment: string | null;
}

const APPROVE_WORDS = new Set(['SI', 'YES', 'Y', 'OK', 'APRUEBO', 'APROBAR', 'APROBADO', 'APROBADA']);
const REJECT_WORDS = new Set(['NO', 'N', 'RECHAZO', 'RECHAZAR', 'RECHAZADO', 'RECHAZADA']);

const stripAccents = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Separa la primera "palabra" (letras/dígitos) del resto del texto. */
// Construida con RegExp porque el target de TS (es2017) no admite los flags s/u en literales.
const WORD_RE = new RegExp('^[\\s,.;:!¡¿?\\-]*([\\p{L}\\p{N}]+)(.*)$', 'su');

const takeWord = (text: string): { word: string; rest: string } | null => {
  const match = WORD_RE.exec(text);
  if (!match) return null;
  return { word: match[1], rest: match[2] };
};

/**
 * Interpreta la respuesta SMS de un admin:
 *   "SI", "Sí A12", "ok a12", "NO A12 falta la fecha", "no, porque no".
 * Devuelve null si el texto no empieza con una palabra de aprobación/rechazo.
 */
export const parseApprovalReply = (raw: string | null | undefined): ParsedApprovalReply | null => {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const first = takeWord(text);
  if (!first) return null;

  const keyword = stripAccents(first.word).toUpperCase();
  let decision: ApprovalDecision;
  if (APPROVE_WORDS.has(keyword)) decision = 'approve';
  else if (REJECT_WORDS.has(keyword)) decision = 'reject';
  else return null;

  let rest = first.rest;
  let code: string | null = null;

  const second = takeWord(rest);
  if (second) {
    const candidate = stripAccents(second.word).toUpperCase();
    if (/^[A-Z]\d{1,4}$/.test(candidate)) {
      code = candidate;
      rest = second.rest;
    }
  }

  const comment = rest.replace(/^[\s,.;:!\-]+/, '').trim();

  return {
    decision,
    code,
    comment: comment.length ? comment.slice(0, 1000) : null,
  };
};
