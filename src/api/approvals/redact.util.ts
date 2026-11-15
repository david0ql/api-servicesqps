const SENSITIVE_KEYS = /^(password|token|secret|apikey|api_key|accesstoken)$/i;

/** Copia profunda sin contraseñas/tokens (para listar y para guardar resultados). */
export const redactSensitive = <T>(value: T, depth = 0): T => {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '***' : redactSensitive(v, depth + 1);
  }
  return out as T;
};

export const hasSensitiveKeys = (value: unknown, depth = 0): boolean => {
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((v) => hasSensitiveKeys(v, depth + 1));
  return Object.entries(value as Record<string, unknown>)
    .some(([k, v]) => SENSITIVE_KEYS.test(k) || hasSensitiveKeys(v, depth + 1));
};
