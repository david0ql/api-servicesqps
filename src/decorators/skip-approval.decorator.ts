import { SetMetadata } from '@nestjs/common';

export const SKIP_APPROVAL_KEY = 'skipApproval';

/**
 * Marca un endpoint como exento del flujo de aprobación del rol Admin Papel.
 * Usar SOLO en endpoints que no modifican datos aunque sean POST (búsquedas,
 * listados) o que tienen su propio control (login, webhooks, aprobaciones).
 * Todo POST/PUT/PATCH/DELETE sin este decorador queda en aprobación.
 */
export const SkipApproval = () => SetMetadata(SKIP_APPROVAL_KEY, true);
