/**
 * Normaliza un teléfono para comparar: solo dígitos y los últimos 10 (número
 * de EE.UU. sin código de país). "+1 (786) 555-1234" y "7865551234" coinciden.
 */
export const normalizePhone = (phone: string | null | undefined): string => {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export const samePhone = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na.length >= 7 && na === nb;
};
