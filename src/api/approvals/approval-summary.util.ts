/**
 * Arma el resumen legible de una solicitud (lo que leen los admins en el SMS),
 * p. ej. "editar servicio #123 (Comunidad X, 2026-11-20) - cambia: fecha, cleaner".
 * Es una función pura: el servicio le pasa el registro existente/lookups.
 */

export const RESOURCE_LABELS: Record<string, string> = {
  services: 'servicio',
  'recurring-services': 'servicio recurrente',
  communities: 'comunidad',
  users: 'usuario',
  companies: 'compañía',
  costs: 'costo',
  'recurring-costs': 'costo recurrente',
  extras: 'extra',
  types: 'tipo de servicio',
  statuses: 'estado',
  reviews: 'revisión',
};

const FIELD_LABELS: Record<string, string> = {
  date: 'fecha',
  schedule: 'hora',
  userId: 'cleaner',
  statusId: 'estado',
  communityId: 'comunidad',
  typeId: 'tipo',
  unitNumber: 'unidad',
  unitySize: 'tamaño',
  comment: 'comentario',
  userComment: 'nota',
  extraId: 'extras',
  extraIds: 'extras',
  daysOfWeek: 'días',
  qaHiddenDays: 'días ocultos QA',
  isActive: 'activo',
  password: 'contraseña',
  roleId: 'rol',
  name: 'nombre',
  email: 'email',
  phoneNumber: 'teléfono',
  amount: 'monto',
  description: 'descripción',
  category: 'categoría',
  communityName: 'nombre',
  companyName: 'nombre',
  companyId: 'compañía',
  supervisorUserId: 'supervisor',
  managerUserId: 'manager',
  vendorUserId: 'vendedor',
  price: 'precio',
  commission: 'comisión',
  item: 'nombre',
  itemPrice: 'precio',
  startDate: 'inicio',
  endDate: 'fin',
};

const ACTIONS: Record<string, string> = {
  POST: 'crear',
  PUT: 'editar',
  PATCH: 'editar',
  DELETE: 'eliminar',
};

export interface SummaryInput {
  method: string;
  /** Path sin query string, ej. "/services/123". */
  path: string;
  query?: Record<string, unknown>;
  body?: Record<string, any> | null;
  /** Registro existente (edición/borrado) o datos resueltos (nombre de la
   *  comunidad al crear). Puede venir vacío si no se pudo consultar. */
  target?: Record<string, any> | null;
}

const MAX_SUMMARY = 300;

const asText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.length ? value.join('/') : null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const dateText = (value: unknown): string | null => {
  const text = asText(value);
  if (!text) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : text;
};

const money = (value: unknown): string | null => {
  const text = asText(value);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : text;
};

/** Campos clave a mostrar por recurso (en orden). */
export const describeRecord = (resource: string, data: Record<string, any>): string[] => {
  const community = asText(data.community?.communityName ?? data.communityName);
  const parts: (string | null)[] = (() => {
    switch (resource) {
      case 'services':
        return [community, dateText(data.date), data.unitNumber ? `unidad ${asText(data.unitNumber)}` : null];
      case 'recurring-services':
        return [community, data.unitNumber ? `unidad ${asText(data.unitNumber)}` : null, asText(data.daysOfWeek)];
      case 'communities':
        return [asText(data.communityName)];
      case 'users':
        return [asText(data.name), asText(data.email)];
      case 'companies':
        return [asText(data.companyName)];
      case 'costs':
        return [asText(data.description), money(data.amount), dateText(data.date)];
      case 'recurring-costs':
        return [asText(data.description), money(data.amount)];
      case 'extras':
        return [asText(data.item), money(data.itemPrice)];
      case 'types':
        return [asText(data.description ?? data.cleaningType), money(data.price)];
      case 'statuses':
        return [asText(data.statusName)];
      default:
        return [];
    }
  })();
  return parts.filter((p): p is string => Boolean(p));
};

const changedFields = (body?: Record<string, any> | null): string[] => {
  if (!body || typeof body !== 'object') return [];
  const labels = Object.keys(body)
    .filter((key) => key !== 'id')
    .map((key) => FIELD_LABELS[key] ?? key);
  return [...new Set(labels)];
};

const truncate = (text: string) => (text.length > MAX_SUMMARY ? `${text.slice(0, MAX_SUMMARY - 3)}...` : text);

const withDetails = (base: string, details: string[]) => (details.length ? `${base} (${details.join(', ')})` : base);

export const parseResourcePath = (path: string) => {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  return {
    segments,
    resource: segments[0] ?? '',
    id: segments[1] && /^\d+$/.test(segments[1]) ? segments[1] : null,
    sub: segments[2] ?? null,
  };
};

export const buildApprovalSummary = (input: SummaryInput): string => {
  const method = input.method.toUpperCase();
  const { segments, resource, id, sub } = parseResourcePath(input.path);
  const body = input.body ?? {};
  const target = input.target ?? {};
  const label = RESOURCE_LABELS[resource] ?? resource ?? 'recurso';
  const action = ACTIONS[method] ?? method.toLowerCase();

  // Casos especiales de servicios.
  if (resource === 'services') {
    if (method === 'PATCH' && id && sub === 'qa-flag') {
      const flag = body.qaFlagged ? 'marcar' : 'desmarcar';
      return truncate(withDetails(`${flag} QA del servicio #${id}`, describeRecord('services', target)));
    }
    if (method === 'PATCH' && id && sub === 'kds') {
      const day = asText(body.kdsDay) ?? 'sin día';
      return truncate(withDetails(`mover servicio #${id} en KDS a ${day}`, describeRecord('services', target)));
    }
    if (method === 'POST' && id && (sub === 'start' || sub === 'finish')) {
      const what = sub === 'start' ? 'inicio' : 'fin';
      return truncate(withDetails(`registrar ${what} del servicio #${id}`, describeRecord('services', target)));
    }
    if (method === 'DELETE' && segments[1] === 'community' && segments[3] === 'range') {
      const community = asText(target.communityName) ?? `#${segments[2]}`;
      const from = dateText(input.query?.startDate) ?? '?';
      const to = dateText(input.query?.endDate) ?? '?';
      return truncate(`eliminar servicios de la comunidad ${community} del ${from} al ${to}`);
    }
  }

  if (resource === 'reviews' && method === 'POST') {
    const serviceId = asText(body.serviceId);
    return truncate(serviceId ? `crear revisión del servicio #${serviceId}` : `crear revisión (${segments.slice(1).join('/')})`);
  }

  if (method === 'POST' && !id) {
    const details = describeRecord(resource, { ...target, ...body });
    return truncate(withDetails(`${action} ${label}`, details));
  }

  const ref = id ? `${label} #${id}` : `${label} ${segments.slice(1).join('/')}`.trim();
  const details = describeRecord(resource, target);
  const base = withDetails(`${action} ${ref}`, details);

  if (method === 'PATCH' || method === 'PUT') {
    const changes = changedFields(body);
    return truncate(changes.length ? `${base} - cambia: ${changes.join(', ')}` : base);
  }

  return truncate(base);
};
