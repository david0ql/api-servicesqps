import { createHmac } from 'crypto';

import { parseApprovalReply } from './sms-reply.parser';
import { normalizePhone, samePhone } from './phone.util';
import { generateUniqueApprovalCode, randomApprovalCode, APPROVAL_CODE_PATTERN } from './approval-code.util';
import { decideApprovalInterception } from './approval-decision.util';
import { buildApprovalSummary } from './approval-summary.util';
import { verifyTextBeeSignature } from '../../textbee/textbee-signature.util';
import { isAdminLike, isAdminPapel } from '../../constants/roles';
import { msgNewRequest, msgAlreadyDecided, requesterLabel } from './approval-messages';

describe('parseApprovalReply', () => {
  it.each([
    ['SI', 'approve', null, null],
    ['si', 'approve', null, null],
    ['Sí A12', 'approve', 'A12', null],
    ['SÍ a12', 'approve', 'A12', null],
    ['yes b7', 'approve', 'B7', null],
    ['Y', 'approve', null, null],
    ['ok, C3', 'approve', 'C3', null],
    ['NO', 'reject', null, null],
    ['n', 'reject', null, null],
    ['NO A12 falta la fecha', 'reject', 'A12', 'falta la fecha'],
    ['No, A12: la comunidad está cerrada', 'reject', 'A12', 'la comunidad está cerrada'],
    ['no porque no', 'reject', null, 'porque no'],
    ['  Si   A12   gracias ', 'approve', 'A12', 'gracias'],
  ])('%s', (text, decision, code, comment) => {
    expect(parseApprovalReply(text)).toEqual({ decision, code, comment });
  });

  it.each(['', '   ', 'hola', 'Sin problema', 'NOPE', 'okey', 'A12 SI'])('no entiende "%s"', (text) => {
    expect(parseApprovalReply(text)).toBeNull();
  });
});

describe('phone utils', () => {
  it('normaliza a los últimos 10 dígitos', () => {
    expect(normalizePhone('+1 (786) 555-1234')).toBe('7865551234');
    expect(normalizePhone('7865551234')).toBe('7865551234');
    expect(normalizePhone(null)).toBe('');
  });

  it('compara teléfonos con distinto formato', () => {
    expect(samePhone('+17865551234', '786-555-1234')).toBe(true);
    expect(samePhone('+17865551234', '+17865551235')).toBe(false);
    expect(samePhone('', '')).toBe(false);
  });
});

describe('approval codes', () => {
  it('genera letra + número', () => {
    for (let i = 0; i < 50; i++) expect(randomApprovalCode()).toMatch(APPROVAL_CODE_PATTERN);
  });

  it('evita códigos tomados', () => {
    const seq = ['A1', 'A1', 'B2'];
    const random = jest.fn(() => seq.shift()!);
    expect(generateUniqueApprovalCode(new Set(['A1']), random)).toBe('B2');
  });

  it('amplía el rango si hay muchos choques', () => {
    const random = jest.fn((max: number) => (max > 99 ? 'Z500' : 'A1'));
    expect(generateUniqueApprovalCode(new Set(['A1']), random)).toBe('Z500');
  });
});

describe('roles', () => {
  it('isAdminLike / isAdminPapel', () => {
    expect(isAdminLike('1')).toBe(true);
    expect(isAdminLike('9')).toBe(true);
    expect(isAdminLike(9)).toBe(true);
    expect(isAdminLike('7')).toBe(false);
    expect(isAdminLike(null)).toBe(false);
    expect(isAdminPapel('9')).toBe(true);
    expect(isAdminPapel('1')).toBe(false);
  });
});

describe('decideApprovalInterception', () => {
  const papel = { id: '50', roleId: '9' };
  const admin = { id: '1', roleId: '1' };

  it('deja pasar lecturas', () => {
    expect(decideApprovalInterception({ method: 'GET', skip: false, user: papel })).toBe('pass');
  });

  it('deja pasar a usuarios que no son Admin Papel', () => {
    expect(decideApprovalInterception({ method: 'POST', skip: false, user: admin })).toBe('pass');
    expect(decideApprovalInterception({ method: 'POST', skip: false, user: undefined })).toBe('pass');
  });

  it('deja pasar endpoints exentos', () => {
    expect(decideApprovalInterception({ method: 'POST', skip: true, user: papel })).toBe('pass');
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'patch'])('encola %s del Admin Papel', (method) => {
    expect(decideApprovalInterception({ method, skip: false, user: papel })).toBe('queue');
  });

  it('reconoce la re-ejecución con token', () => {
    expect(decideApprovalInterception({ method: 'PATCH', skip: false, user: papel, approvalToken: 'abc' })).toBe('replay');
    expect(decideApprovalInterception({ method: 'PATCH', skip: false, user: papel, approvalToken: '  ' })).toBe('queue');
  });
});

describe('buildApprovalSummary', () => {
  it('crear servicio con comunidad y fecha', () => {
    expect(buildApprovalSummary({
      method: 'POST',
      path: '/services',
      body: { date: '2026-11-20', unitNumber: '204', communityId: '3' },
      target: { communityName: 'Comunidad X' },
    })).toBe('crear servicio (Comunidad X, 2026-11-20, unidad 204)');
  });

  it('editar servicio lista los campos cambiados', () => {
    expect(buildApprovalSummary({
      method: 'PATCH',
      path: '/services/123',
      body: { date: '2026-11-21', userId: '8' },
      target: { community: { communityName: 'Comunidad X' }, date: '2026-11-20', unitNumber: '204' },
    })).toBe('editar servicio #123 (Comunidad X, 2026-11-20, unidad 204) - cambia: fecha, cleaner');
  });

  it('eliminar usuario', () => {
    expect(buildApprovalSummary({
      method: 'DELETE',
      path: '/users/9',
      target: { name: 'Ana', email: 'ana@x.com' },
    })).toBe('eliminar usuario #9 (Ana, ana@x.com)');
  });

  it('borrado por rango de comunidad', () => {
    expect(buildApprovalSummary({
      method: 'DELETE',
      path: '/services/community/3/range',
      query: { startDate: '2026-11-01', endDate: '2026-11-30' },
      target: { communityName: 'Comunidad X' },
    })).toBe('eliminar servicios de la comunidad Comunidad X del 2026-11-01 al 2026-11-30');
  });

  it('serie recurrente nueva', () => {
    expect(buildApprovalSummary({
      method: 'POST',
      path: '/recurring-services',
      body: { communityId: '3', unitNumber: '10', daysOfWeek: ['mon', 'thu'] },
      target: { communityName: 'Comunidad X' },
    })).toBe('crear servicio recurrente (Comunidad X, unidad 10, mon/thu)');
  });

  it('kds y qa-flag', () => {
    expect(buildApprovalSummary({ method: 'PATCH', path: '/services/5/kds', body: { kdsDay: 'monday' } }))
      .toBe('mover servicio #5 en KDS a monday');
    expect(buildApprovalSummary({ method: 'PATCH', path: '/services/5/qa-flag', body: { qaFlagged: true } }))
      .toBe('marcar QA del servicio #5');
  });

  it('recurso sin datos de contexto', () => {
    expect(buildApprovalSummary({ method: 'PATCH', path: '/communities/4', body: { communityName: 'Nueva' } }))
      .toBe('editar comunidad #4 - cambia: nombre');
  });

  it('corta resúmenes largos', () => {
    const summary = buildApprovalSummary({ method: 'POST', path: '/communities', body: { communityName: 'x'.repeat(500) } });
    expect(summary.length).toBeLessThanOrEqual(300);
  });
});

describe('verifyTextBeeSignature', () => {
  const secret = 'shhh';
  const body = JSON.stringify({ sender: '+17865551234', message: 'SI A12', webhookEvent: 'MESSAGE_RECEIVED' });
  const sig = createHmac('sha256', secret).update(body).digest('hex');

  it('acepta X-Signature válida (string o Buffer)', () => {
    expect(verifyTextBeeSignature(secret, body, { signature: sig })).toBe(true);
    expect(verifyTextBeeSignature(secret, Buffer.from(body), { signature: `sha256=${sig}` })).toBe(true);
  });

  it('rechaza firma inválida, ausente o sin secreto', () => {
    expect(verifyTextBeeSignature(secret, body, { signature: sig.replace(/.$/, '0') === sig ? 'ff' : sig.replace(/.$/, '0') })).toBe(false);
    expect(verifyTextBeeSignature(secret, body, {})).toBe(false);
    expect(verifyTextBeeSignature('', body, { signature: sig })).toBe(false);
    expect(verifyTextBeeSignature(secret, `${body} `, { signature: sig })).toBe(false);
  });

  it('valida X-Textbee-Signature con timestamp y tolerancia', () => {
    const t = 1_800_000_000;
    const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    const header = `t=${t},v1=${v1}`;
    expect(verifyTextBeeSignature(secret, body, { timestampedSignature: header }, { nowSeconds: t + 10 })).toBe(true);
    expect(verifyTextBeeSignature(secret, body, { timestampedSignature: header }, { nowSeconds: t + 3600 })).toBe(false);
    // Si viene la firma con timestamp, no basta con X-Signature.
    expect(verifyTextBeeSignature(secret, body, { signature: sig, timestampedSignature: 't=1,v1=00' }, { nowSeconds: 1 })).toBe(false);
  });
});

describe('approval messages', () => {
  it('SMS de nueva solicitud', () => {
    expect(msgNewRequest('Diego', { code: 'A12', summary: 'editar servicio #123 (Comunidad X, 2026-11-20)' })).toBe(
      'QPS: Diego (Admin Papel) quiere editar servicio #123 (Comunidad X, 2026-11-20). '
      + 'Responde SI A12 para aprobar o NO A12 <comentario> para rechazar.',
    );
  });

  it('no duplica "Admin Papel" en el nombre', () => {
    expect(requesterLabel('Administrador Papel')).toBe('Administrador Papel');
  });

  it('respuesta tardía', () => {
    expect(msgAlreadyDecided('A12', 'executed', 'Felix')).toBe('QPS: La solicitud A12 ya fue aprobada por Felix.');
    expect(msgAlreadyDecided('A12', 'rejected', 'Felix')).toBe('QPS: La solicitud A12 ya fue rechazada por Felix.');
    expect(msgAlreadyDecided('A12', 'expired')).toBe('QPS: La solicitud A12 ya expiró sin respuesta.');
  });
});

import { hasSensitiveKeys, redactSensitive } from './redact.util';

describe('redactSensitive', () => {
  it('oculta contraseñas y tokens en profundidad', () => {
    const body = { name: 'Ana', password: 'x', nested: [{ token: 't', ok: 1 }] };
    expect(redactSensitive(body)).toEqual({ name: 'Ana', password: '***', nested: [{ token: '***', ok: 1 }] });
    expect(body.password).toBe('x');
    expect(hasSensitiveKeys(body)).toBe(true);
    expect(hasSensitiveKeys({ name: 'Ana' })).toBe(false);
    expect(redactSensitive(null)).toBeNull();
  });
});

describe('randomApprovalCode con prefijo de tenant', () => {
  it('usa siempre la letra del tenant', () => {
    for (let i = 0; i < 50; i++) expect(randomApprovalCode(99, 'v')).toMatch(/^V\d{1,2}$/);
  });
});
