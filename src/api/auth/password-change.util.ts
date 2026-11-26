/**
 * Cambio de clave obligatorio.
 *
 * Cuando un admin marca a un usuario con `mustChangePassword`, toda petición
 * autenticada con JWT responde 403 PASSWORD_CHANGE_REQUIRED, salvo las rutas
 * de esta lista: las mínimas para que la app/web nueva muestre la pantalla
 * "Crea tu nueva clave" y la complete. Las apps viejas (sin esa pantalla)
 * quedan bloqueadas con el mensaje de actualizar.
 *
 * El chequeo vive en JwtStrategy.validate (corre dentro de AuthGuard('jwt'),
 * antes de cualquier interceptor, incluido el de aprobaciones), así que aplica
 * a todos los endpoints con JWT sin depender del orden de los interceptores.
 */

export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';
export const PASSWORD_CHANGE_REQUIRED_MESSAGE = 'Debes cambiar tu clave. Actualiza la app si no ves la opción.';

export const passwordChangeRequiredBody = () => ({
  statusCode: 403,
  code: PASSWORD_CHANGE_REQUIRED_CODE,
  message: PASSWORD_CHANGE_REQUIRED_MESSAGE,
  error: 'Forbidden',
});

interface AllowRule {
  method: string;
  pattern: RegExp;
  /** Si existe, el grupo 1 del patrón debe ser el id del propio usuario. */
  selfOnly?: boolean;
}

const ALLOWLIST: AllowRule[] = [
  // Login (no lleva JWT, pero por si un cliente manda un token viejo).
  { method: 'POST', pattern: /^\/auth$/ },
  // Estado del usuario: la app lo consulta al abrir/volver a primer plano.
  { method: 'GET', pattern: /^\/auth\/me$/ },
  // El propio cambio de clave.
  { method: 'POST', pattern: /^\/auth\/change-password$/ },
  // Perfil propio: la app y la web lo piden justo después del login.
  { method: 'GET', pattern: /^\/users\/(\d+)$/, selfOnly: true },
  // Push token del dispositivo (multi-cuenta): se registra al abrir la app.
  { method: 'POST', pattern: /^\/users\/me\/push-token$/ },
  { method: 'DELETE', pattern: /^\/users\/me\/push-token$/ },
];

/** Quita query string, barras finales y normaliza a minúsculas. */
export const normalizeRequestPath = (url: string | undefined | null): string => {
  const path = String(url ?? '').split('?')[0].split('#')[0];
  const trimmed = path.replace(/\/+$/, '');
  return (trimmed || '/').toLowerCase();
};

export const isAllowedWhilePasswordChangePending = (
  method: string | undefined | null,
  url: string | undefined | null,
  userId: string | number | undefined | null,
): boolean => {
  const verb = String(method ?? '').toUpperCase();
  if (verb === 'OPTIONS') return true;
  const path = normalizeRequestPath(url);

  return ALLOWLIST.some((rule) => {
    if (rule.method !== verb) return false;
    const match = rule.pattern.exec(path);
    if (!match) return false;
    if (rule.selfOnly) return userId != null && match[1] === String(userId);
    return true;
  });
};

/** true si la petición debe cortarse con 403 PASSWORD_CHANGE_REQUIRED. */
export const shouldBlockForPasswordChange = (
  user: { id: string | number; mustChangePassword?: boolean | number | null } | null | undefined,
  method: string | undefined | null,
  url: string | undefined | null,
): boolean => {
  if (!user || !user.mustChangePassword) return false;
  return !isAllowedWhilePasswordChangePending(method, url, user.id);
};
