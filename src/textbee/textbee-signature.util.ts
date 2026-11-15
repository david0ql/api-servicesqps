import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verificación de firmas de webhooks de TextBee (github.com/vernu/textbee,
 * api/src/webhook/webhook.service.ts). TextBee envía el body como
 * `JSON.stringify(payload)` y firma ESOS bytes:
 *   - `X-Signature`: hex(HMAC-SHA256(secret, body))  (todas las versiones)
 *   - `X-Textbee-Signature`: `t=<unix>,v1=<hex(HMAC-SHA256(secret, "<t>.<body>"))>`
 *     y `X-Textbee-Timestamp` (versiones recientes; protege contra replays).
 * Si viene la firma con timestamp se exige esa; si no, se acepta X-Signature.
 */

export interface TextBeeSignatureHeaders {
  signature?: string | string[];
  timestampedSignature?: string | string[];
}

export interface VerifyOptions {
  /** Tolerancia para el timestamp de X-Textbee-Signature (segundos). */
  toleranceSeconds?: number;
  nowSeconds?: number;
}

const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';

const hmacHex = (secret: string, data: string | Buffer) =>
  createHmac('sha256', secret).update(data).digest('hex');

const safeEqualHex = (expected: string, received: string): boolean => {
  const clean = received.toLowerCase().replace(/^sha256=/, '');
  if (!/^[0-9a-f]+$/.test(clean) || clean.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(clean, 'hex'));
};

export const verifyTextBeeSignature = (
  secret: string,
  rawBody: string | Buffer,
  headers: TextBeeSignatureHeaders,
  options: VerifyOptions = {},
): boolean => {
  if (!secret || rawBody === undefined || rawBody === null) return false;

  const timestamped = first(headers.timestampedSignature);
  if (timestamped) {
    const parts = Object.fromEntries(
      timestamped.split(',').map((part) => {
        const [k, ...v] = part.split('=');
        return [k.trim(), v.join('=').trim()];
      }),
    );
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1 || !/^\d+$/.test(t)) return false;

    const tolerance = options.toleranceSeconds ?? 300;
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(t)) > tolerance) return false;

    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    return safeEqualHex(hmacHex(secret, `${t}.${body}`), v1);
  }

  const signature = first(headers.signature);
  if (!signature) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature);
};
