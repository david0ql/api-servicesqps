import { randomInt } from 'crypto';

/** Letras sin I/O/L para no confundir con 1/0 al teclear en el teléfono. */
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export const APPROVAL_CODE_PATTERN = /^[A-Z]\d{1,4}$/;

/** Código corto letra + número (ej. "A12"). `maxNumber` crece si hay choques. */
export const randomApprovalCode = (maxNumber = 99): string => {
  const letter = LETTERS[randomInt(LETTERS.length)];
  const number = randomInt(1, maxNumber + 1);
  return `${letter}${number}`;
};

/**
 * Genera un código que no esté en `taken` (los códigos de solicitudes
 * pendientes). Tras varios choques amplía el rango numérico.
 */
export const generateUniqueApprovalCode = (
  taken: Set<string>,
  random: (maxNumber: number) => string = randomApprovalCode,
): string => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const maxNumber = attempt < 50 ? 99 : attempt < 120 ? 999 : 9999;
    const code = random(maxNumber);
    if (!taken.has(code)) return code;
  }
  throw new Error('No se pudo generar un código de aprobación único.');
};
