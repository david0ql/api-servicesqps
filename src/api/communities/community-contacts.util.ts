export const COMMUNITY_CONTACT_FIELDS = [
  'maintenanceSupervisorName',
  'maintenanceSupervisorPhone',
  'technicianName',
  'technicianPhone',
  'managerContactName',
  'managerContactPhone',
] as const;

export type CommunityContactField = (typeof COMMUNITY_CONTACT_FIELDS)[number];

/** Limpia los contactos que llegan del front: recorta espacios y guarda `null`
 *  cuando el campo queda vacio, para que la app no muestre contactos en blanco.
 *  Los campos ausentes (`undefined`) se respetan para no pisarlos en un PATCH. */
export function normalizeCommunityContacts<T extends object>(dto: T): T {
  const result = { ...dto } as Record<string, unknown>;

  for (const field of COMMUNITY_CONTACT_FIELDS) {
    const value = result[field];
    if (value === undefined) continue;

    const trimmed = typeof value === 'string' ? value.trim() : null;
    result[field] = trimmed ? trimmed : null;
  }

  return result as T;
}
