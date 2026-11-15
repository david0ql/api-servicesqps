import { ServicesEntity } from '../../entities/services.entity';
import { ServiceStatusId } from '../../constants/service-status.enum';

/**
 * Refresh de un servicio (la QA encontro items fallidos).
 *
 * Antes solo se pasaba el servicio a Approved (3) y se dejaban started_at y
 * finished_at puestos. La app muestra "Start" solo si no hay started_at y
 * "Finish" solo si hay started_at sin finished_at, y el API rechaza ambos
 * checkpoints si ya estan marcados: la cleaner quedaba sin forma de terminar
 * el refresh.
 *
 * Ahora el refresh guarda el intento anterior (last_started_at,
 * last_finished_at y una entrada en refresh_history) y limpia los checkpoints
 * de inicio/fin con su GPS para que el servicio se pueda iniciar y finalizar
 * otra vez. Al finalizar vuelve a Completed (5) y la QA lo revisa de nuevo.
 */

export interface RefreshHistoryEntry {
  refreshedAt: string;
  qaUserId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  startLatitude: string | null;
  startLongitude: string | null;
  finishLatitude: string | null;
  finishLongitude: string | null;
}

type RefreshSource = Pick<
  ServicesEntity,
  | 'statusId'
  | 'startedAt'
  | 'finishedAt'
  | 'startLatitude'
  | 'startLongitude'
  | 'finishLatitude'
  | 'finishLongitude'
  | 'refreshCount'
  | 'refreshHistory'
> & Partial<Pick<ServicesEntity, 'qaUserId'>>;

/**
 * Solo se reinicia un servicio que la cleaner ya habia trabajado (Completed o
 * Finished, o con finished_at). Si la QA vuelve a mandar una revision fallida
 * sobre un servicio que ya esta en refresh y aun no se termina, no se cuenta
 * un refresh nuevo ni se pisa el historial.
 */
export function shouldResetForRefresh(service: Pick<ServicesEntity, 'statusId' | 'finishedAt'>): boolean {
  return (
    Boolean(service.finishedAt) ||
    service.statusId === ServiceStatusId.Completed ||
    service.statusId === ServiceStatusId.Finished
  );
}

export function parseRefreshHistory(raw: string | null | undefined): RefreshHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Campos a actualizar en el servicio al marcar un refresh. No incluye
 * statusId: eso lo decide quien llama (reviews.service).
 */
export function buildRefreshResetUpdate(
  service: RefreshSource,
  now: Date = new Date(),
  qaUserId: string | null = null,
): Partial<ServicesEntity> {
  const history = parseRefreshHistory(service.refreshHistory);
  history.push({
    refreshedAt: now.toISOString(),
    qaUserId: qaUserId ?? service.qaUserId ?? null,
    startedAt: toIso(service.startedAt),
    finishedAt: toIso(service.finishedAt),
    startLatitude: service.startLatitude ?? null,
    startLongitude: service.startLongitude ?? null,
    finishLatitude: service.finishLatitude ?? null,
    finishLongitude: service.finishLongitude ?? null,
  });

  return {
    refreshCount: (Number(service.refreshCount) || 0) + 1,
    lastRefreshedAt: now,
    lastStartedAt: service.startedAt ?? null,
    lastFinishedAt: service.finishedAt ?? null,
    refreshHistory: JSON.stringify(history),

    startedAt: null,
    startLatitude: null,
    startLongitude: null,
    startAccuracy: null,
    startAltitude: null,
    startAltitudeAccuracy: null,
    startHeading: null,
    startSpeed: null,
    startLocationMeta: null,

    finishedAt: null,
    finishLatitude: null,
    finishLongitude: null,
    finishAccuracy: null,
    finishAltitude: null,
    finishAltitudeAccuracy: null,
    finishHeading: null,
    finishSpeed: null,
    finishLocationMeta: null,
  };
}
