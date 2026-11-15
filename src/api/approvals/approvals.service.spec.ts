jest.mock('../../config/env', () => ({
  __esModule: true,
  default: { APPROVAL_SMS_ENABLED: true, APPROVAL_EXPIRATION_HOURS: 48, PORT: 3000, ENABLE_NOTIFICATIONS: false },
}));

// Estas entidades importan con alias 'src/...', que jest no resuelve.
jest.mock('../../entities/costs.entity', () => ({ CostsEntity: class CostsEntity {} }));
jest.mock('../../entities/recurring_costs.entity', () => ({ RecurringCostsEntity: class RecurringCostsEntity {} }));
jest.mock('../../dto/page-meta.dto', () => ({ PageMetaDto: class PageMetaDto {} }));

import envVars from '../../config/env';
import { ApprovalsService, hashApprovalToken } from './approvals.service';

type Row = Record<string, any>;

/** Repo en memoria con el subset de TypeORM que usa el servicio. */
const makePendingRepo = (rows: Row[]) => {
  let nextId = 100;
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && '_type' in v) {
        if (v._type === 'lessThan') return row[k] < v._value;
        return true;
      }
      return String(row[k]) === String(v);
    });

  const updateBuilder = () => {
    const state: { set?: Row; conds: Array<(r: Row) => boolean> } = { conds: [] };
    const addCond = (sql: string, params: Row = {}) => {
      if (sql.startsWith('id =')) state.conds.push((r) => String(r.id) === String(params.id));
      else if (sql.startsWith('status =')) state.conds.push((r) => r.status === (params.pending ?? params.status));
      else if (sql.startsWith('token_consumed_at IS NULL')) state.conds.push((r) => !r.tokenConsumedAt);
    };
    const qb: any = {
      update: () => qb,
      set: (s: Row) => { state.set = s; return qb; },
      where: (sql: string, p?: Row) => { addCond(sql, p); return qb; },
      andWhere: (sql: string, p?: Row) => { addCond(sql, p); return qb; },
      execute: async () => {
        const hit = rows.filter((r) => state.conds.every((c) => c(r)));
        hit.forEach((r) => Object.entries(state.set!).forEach(([k, v]) => { r[k] = typeof v === 'function' ? new Date() : v; }));
        return { affected: hit.length };
      },
    };
    return qb;
  };

  return {
    rows,
    find: jest.fn(async ({ where }: Row = {}) => rows.filter((r) => matches(r, where))),
    findOne: jest.fn(async ({ where, order }: Row) => {
      const found = rows.filter((r) => matches(r, where));
      if (order?.createdAt === 'DESC') found.sort((a, b) => b.createdAt - a.createdAt);
      return found[0] ?? null;
    }),
    create: jest.fn((data: Row) => ({ ...data })),
    save: jest.fn(async (data: Row) => { const row = { id: String(nextId++), createdAt: new Date(), ...data }; rows.push(row); return row; }),
    update: jest.fn(async (id: string, data: Row) => { Object.assign(rows.find((r) => r.id === id)!, data); }),
    createQueryBuilder: jest.fn((alias?: string) => {
      if (alias === 'pc') {
        let hash: string | undefined;
        const qb: any = {
          where: (_: string, p: Row) => { hash = p.hash; return qb; },
          getOne: async () => rows.find((r) => r.approvalTokenHash === hash) ?? null,
        };
        return qb;
      }
      return updateBuilder();
    }),
  };
};

const diego = { id: '50', name: 'Diego', email: 'diego@qps.com', roleId: '9', phoneNumber: '+13055550000', isActive: true, token: '' };
const felix = { id: '1', name: 'Felix', email: 'felix@qps.com', roleId: '1', phoneNumber: '+1 (786) 555-1111', isActive: true, token: '' };
const ana = { id: '2', name: 'Ana', email: 'ana@qps.com', roleId: '1', phoneNumber: '7865552222', isActive: true, token: '' };

const setup = (rows: Row[] = []) => {
  const pendingRepo = makePendingRepo(rows);
  const users = [diego, felix, ana];
  // Las relaciones user/decidedByUser se resuelven al leer la fila.
  const origFindOne = pendingRepo.findOne;
  pendingRepo.findOne = jest.fn(async (opts: Row) => {
    const row = await origFindOne(opts);
    if (row && opts.relations) {
      row.user = users.find((u) => u.id === row.userId);
      row.decidedByUser = users.find((u) => u.id === row.decidedByUserId) ?? null;
    }
    return row;
  });
  const usersRepo = {
    find: jest.fn(async ({ where }: Row) => users.filter((u) => u.roleId === where.roleId && u.isActive)),
    findOne: jest.fn(async ({ where }: Row) => users.find((u) => u.id === where.id) ?? null),
  };
  const dataSource = { getRepository: jest.fn(() => ({ findOne: jest.fn(async () => ({ communityName: 'Comunidad X' })) })) };
  const textBee = { sendSMS: jest.fn(async () => true) };
  const push = { sendNotification: jest.fn(async () => ({ done: true })) };
  const executor = { replay: jest.fn(async (): Promise<{ status: number; body: any }> => ({ status: 200, body: { id: '123' } })) };

  const links: Row[] = [];
  const linksRepo = {
    rows: links,
    create: jest.fn((data: Row) => ({ ...data })),
    save: jest.fn(async (data: Row) => { const row = { id: String(links.length + 1), ...data }; links.push(row); return row; }),
    findOne: jest.fn(async ({ where }: Row) => links.find((l) => l.tokenHash === where.tokenHash) ?? null),
    update: jest.fn(async ({ id }: Row, data: Row) => { Object.assign(links.find((l) => l.id === id)!, data); }),
  };

  const service = new ApprovalsService(
    pendingRepo as any, usersRepo as any, linksRepo as any, dataSource as any, textBee as any, push as any, executor as any,
  );
  const smsTo = (phone: string) => textBee.sendSMS.mock.calls.filter((c: any[]) => c[0] === phone).map((c: any[]) => c[1]);
  return { service, pendingRepo, textBee, executor, smsTo, linksRepo };
};

const pendingRow = (over: Row = {}): Row => ({
  id: '10', code: 'A12', method: 'PATCH', url: '/services/123', body: { date: '2026-11-21' },
  userId: '50', summary: 'editar servicio #123 (Comunidad X, 2026-11-20)', status: 'pending',
  createdAt: new Date(), ...over,
});

describe('ApprovalsService', () => {
  describe('queueRequest', () => {
    it('guarda la solicitud con código y avisa por SMS a los super admins', async () => {
      const { service, smsTo, pendingRepo } = setup();
      const change = await service.queueRequest({
        method: 'PATCH', url: '/services/123', body: { date: '2026-11-21' }, user: diego as any,
      });

      expect(change.code).toMatch(/^[A-Z]\d+$/);
      expect(change.status).toBe('pending');
      expect(pendingRepo.rows).toHaveLength(1);
      expect(change.summary).toContain('editar servicio #123');
      const [felixSms] = smsTo(felix.phoneNumber);
      expect(felixSms).toContain(`Responde SI ${change.code} para aprobar o NO ${change.code}`);
      expect(smsTo(ana.phoneNumber)).toHaveLength(1);
      expect(smsTo(diego.phoneNumber)).toHaveLength(0);
    });
  });

  describe('decide', () => {
    it('aprueba, re-ejecuta con token y notifica a todos', async () => {
      const rows = [pendingRow()];
      const { service, executor, smsTo } = setup(rows);

      const outcome = await service.decide('10', felix as any, 'approve', 'ok', 'sms');

      expect(outcome.applied).toBe(true);
      expect(executor.replay).toHaveBeenCalledTimes(1);
      const replayArg = (executor.replay.mock.calls[0] as any[])[0];
      expect(replayArg).toMatchObject({ method: 'PATCH', url: '/services/123', user: { id: '50' } });
      expect(rows[0].approvalTokenHash).toBe(hashApprovalToken(replayArg.approvalToken));
      expect(rows[0].status).toBe('executed');
      expect(rows[0].decidedByUserId).toBe('1');
      expect(rows[0].decisionChannel).toBe('sms');
      expect(smsTo(diego.phoneNumber)[0]).toContain('fue aprobada por Felix y ya se aplicó');
      expect(smsTo(ana.phoneNumber)[0]).toContain('A12 aprobada por Felix');
      expect(smsTo(felix.phoneNumber)[0]).toBe('QPS: Listo, A12 aprobada y aplicada.');
    });

    it('marca failed si la re-ejecución falla y lo reporta', async () => {
      const rows = [pendingRow()];
      const { service, executor, smsTo } = setup(rows);
      executor.replay.mockResolvedValueOnce({ status: 400, body: { message: ['date must be a date'] } });

      await service.decide('10', felix as any, 'approve', null, 'web');

      expect(rows[0].status).toBe('failed');
      expect(rows[0].resultStatus).toBe(400);
      expect(rows[0].error).toBe('HTTP 400: date must be a date');
      expect(smsTo(diego.phoneNumber)[0]).toContain('falló al aplicarse: HTTP 400: date must be a date');
      expect(smsTo(felix.phoneNumber)).toHaveLength(0); // canal web: sin SMS de confirmación
    });

    it('rechaza sin ejecutar y pasa el comentario', async () => {
      const rows = [pendingRow()];
      const { service, executor, smsTo } = setup(rows);

      await service.decide('10', ana as any, 'reject', 'falta la fecha', 'sms');

      expect(executor.replay).not.toHaveBeenCalled();
      expect(rows[0].status).toBe('rejected');
      expect(rows[0].approvalTokenHash).toBeNull();
      expect(smsTo(diego.phoneNumber)[0]).toBe(
        'QPS: Tu solicitud A12 (editar servicio #123 (Comunidad X, 2026-11-20)) fue rechazada por Ana. Comentario: falta la fecha',
      );
    });

    it('no deja la contraseña en claro al cerrar la solicitud', async () => {
      const rows = [pendingRow({ method: 'POST', url: '/users', body: { name: 'Ana', password: 'secreta' } })];
      const { service } = setup(rows);
      await service.decide('10', felix as any, 'approve', null, 'web');
      expect(rows[0].body).toEqual({ name: 'Ana', password: '***' });
    });

    it('la primera decisión gana', async () => {
      const rows = [pendingRow()];
      const { service, executor } = setup(rows);

      await service.decide('10', felix as any, 'approve', null, 'sms');
      const late = await service.decide('10', ana as any, 'reject', null, 'sms');

      expect(late.applied).toBe(false);
      expect(late.alreadyDecidedBy).toBe('Felix');
      expect(rows[0].status).toBe('executed');
      expect(executor.replay).toHaveBeenCalledTimes(1);
    });
  });

  describe('consumeReplayToken', () => {
    const approved = (token: string) => pendingRow({ status: 'approved', approvalTokenHash: hashApprovalToken(token), tokenConsumedAt: null });

    it('acepta una sola vez el token correcto', async () => {
      const rows = [approved('tok')];
      const { service } = setup(rows);
      expect(await service.consumeReplayToken('tok', 'PATCH', '/services/123', '50')).toBe(true);
      expect(await service.consumeReplayToken('tok', 'PATCH', '/services/123', '50')).toBe(false);
    });

    it.each([
      ['otro token', 'nope', 'PATCH', '/services/123', '50'],
      ['otro método', 'tok', 'DELETE', '/services/123', '50'],
      ['otra url', 'tok', 'PATCH', '/services/124', '50'],
      ['otro usuario', 'tok', 'PATCH', '/services/123', '51'],
    ])('rechaza %s', async (_, token, method, url, userId) => {
      const { service } = setup([approved('tok')]);
      expect(await service.consumeReplayToken(token, method, url, userId)).toBe(false);
    });

    it('rechaza si la solicitud no está aprobada', async () => {
      const { service } = setup([{ ...approved('tok'), status: 'executed' }]);
      expect(await service.consumeReplayToken('tok', 'PATCH', '/services/123', '50')).toBe(false);
    });
  });

  describe('handleInboundSms', () => {
    it('ignora remitentes que no son super admin', async () => {
      const { service, textBee } = setup([pendingRow()]);
      expect(await service.handleInboundSms(diego.phoneNumber, 'SI')).toBe('ignored:not-admin');
      expect(await service.handleInboundSms('+19999999999', 'SI')).toBe('ignored:not-admin');
      expect(textBee.sendSMS).not.toHaveBeenCalled();
    });

    it('sin código y una sola pendiente: la aplica', async () => {
      const rows = [pendingRow()];
      const { service } = setup(rows);
      expect(await service.handleInboundSms('+17865551111', 'sí')).toBe('decided:executed');
      expect(rows[0].decidedByUserId).toBe('1');
    });

    it('sin código y varias pendientes: responde con la lista', async () => {
      const rows = [pendingRow(), pendingRow({ id: '11', code: 'B3', summary: 'crear comunidad (Nueva)' })];
      const { service, smsTo } = setup(rows);
      expect(await service.handleInboundSms('+17865551111', 'NO')).toBe('replied:ambiguous');
      expect(smsTo(felix.phoneNumber)[0]).toContain('Hay 2 solicitudes pendientes: A12');
      expect(smsTo(felix.phoneNumber)[0]).toContain('B3 (crear comunidad (Nueva))');
      expect(rows.every((r) => r.status === 'pending')).toBe(true);
    });

    it('con código aplica a esa y guarda el comentario', async () => {
      const rows = [pendingRow(), pendingRow({ id: '11', code: 'B3' })];
      const { service } = setup(rows);
      expect(await service.handleInboundSms('7865552222', 'NO B3 no corresponde')).toBe('decided:rejected');
      expect(rows[1]).toMatchObject({ status: 'rejected', comment: 'no corresponde', decidedByUserId: '2' });
      expect(rows[0].status).toBe('pending');
    });

    it('respuesta tardía: avisa quién ya decidió', async () => {
      const rows = [pendingRow({ status: 'executed', decidedByUserId: '1' })];
      const { service, smsTo } = setup(rows);
      expect(await service.handleInboundSms('7865552222', 'NO A12')).toBe('replied:already-decided');
      expect(smsTo(ana.phoneNumber)[0]).toBe('QPS: La solicitud A12 ya fue aprobada por Felix.');
    });

    it('texto no reconocido: explica el formato', async () => {
      const { service, smsTo } = setup([pendingRow()]);
      expect(await service.handleInboundSms('7865552222', 'hola')).toBe('replied:not-understood');
      expect(smsTo(ana.phoneNumber)[0]).toContain('Pendientes: A12');
    });

    it('código inexistente', async () => {
      const { service, smsTo } = setup([pendingRow()]);
      expect(await service.handleInboundSms('7865552222', 'SI Z99')).toBe('replied:code-not-found');
      expect(smsTo(ana.phoneNumber)[0]).toContain('No encontré la solicitud Z99');
    });
  });

  describe('handleInboundSms con gateway compartido entre tenants', () => {
    const env = envVars as any;
    beforeEach(() => { env.APPROVAL_SHARED_GATEWAY = true; env.APPROVAL_CODE_PREFIX = 'Q'; });
    afterEach(() => { delete env.APPROVAL_SHARED_GATEWAY; delete env.APPROVAL_CODE_PREFIX; });

    it('ignora sin contestar los códigos de otro tenant', async () => {
      const rows = [pendingRow({ code: 'Q12' })];
      const { service, textBee } = setup(rows);
      expect(await service.handleInboundSms('7865552222', 'SI V7')).toBe('ignored:other-tenant');
      expect(textBee.sendSMS).not.toHaveBeenCalled();
      expect(rows[0].status).toBe('pending');
    });

    it('sin código nunca decide, aunque haya una sola pendiente', async () => {
      const rows = [pendingRow({ code: 'Q12' })];
      const { service, smsTo } = setup(rows);
      expect(await service.handleInboundSms('7865552222', 'SI')).toBe('replied:ambiguous');
      expect(smsTo(ana.phoneNumber)[0]).toContain('Q12');
      expect(rows[0].status).toBe('pending');
    });

    it('sin pendientes en este tenant: silencio', async () => {
      const { service, textBee } = setup([]);
      expect(await service.handleInboundSms('7865552222', 'SI')).toBe('ignored:shared-no-pending');
      expect(await service.handleInboundSms('7865552222', 'hola')).toBe('ignored:shared-no-pending');
      expect(textBee.sendSMS).not.toHaveBeenCalled();
    });

    it('con código propio decide normal', async () => {
      const rows = [pendingRow({ code: 'Q12' })];
      const { service } = setup(rows);
      expect(await service.handleInboundSms('7865552222', 'no q12 falta la fecha')).toBe('decided:rejected');
      expect(rows[0]).toMatchObject({ status: 'rejected', comment: 'falta la fecha' });
    });
  });

  describe('enlace de aprobación por SMS', () => {
    const env = envVars as any;
    beforeEach(() => { env.APPROVAL_LINK_BASE_URL = 'https://web.example.com/'; });
    afterEach(() => { delete env.APPROVAL_LINK_BASE_URL; });

    const tokenFrom = (sms: string) => /#\/approve\/([A-Za-z0-9_-]+)/.exec(sms)![1];

    it('cada admin recibe su propio enlace y no vence', async () => {
      const { service, smsTo, linksRepo } = setup();
      await service.queueRequest({ method: 'PATCH', url: '/services/123', body: { date: '2026-11-21' }, user: diego as any });
      const felixSms = smsTo(felix.phoneNumber)[0];
      const anaSms = smsTo(ana.phoneNumber)[0];
      expect(felixSms).toContain('https://web.example.com/#/approve/');
      expect(tokenFrom(felixSms)).not.toBe(tokenFrom(anaSms));
      expect(linksRepo.rows).toHaveLength(2);
      expect(linksRepo.rows.every((l: Row) => l.expiresAt === null)).toBe(true);
    });

    it('muestra la solicitud y permite rechazar una sola vez', async () => {
      const { service, smsTo, pendingRepo } = setup();
      await service.queueRequest({ method: 'PATCH', url: '/services/123', body: { date: '2026-11-21' }, user: diego as any });
      const token = tokenFrom(smsTo(felix.phoneNumber)[0]);

      const view = await service.getLinkView(token);
      expect(view).toMatchObject({ status: 'pending', adminName: 'Felix', expired: false, used: false });
      expect(view.summary).toContain('editar servicio #123');

      const after = await service.decideFromLink(token, 'reject', 'no corresponde');
      expect(after.status).toBe('rejected');
      expect(pendingRepo.rows[0]).toMatchObject({ status: 'rejected', decisionChannel: 'link', decidedByUserId: '1', comment: 'no corresponde' });
      await expect(service.decideFromLink(token, 'approve')).rejects.toThrow('ya se usó');
    });

    it('si otro admin ya decidió, el enlace avisa quién', async () => {
      const { service, smsTo } = setup();
      await service.queueRequest({ method: 'PATCH', url: '/services/123', body: { date: '2026-11-21' }, user: diego as any });
      const felixToken = tokenFrom(smsTo(felix.phoneNumber)[0]);
      const anaToken = tokenFrom(smsTo(ana.phoneNumber)[0]);
      await service.decideFromLink(anaToken, 'reject');
      await expect(service.decideFromLink(felixToken, 'approve')).rejects.toThrow(/rechazada por Ana/);
    });

    it('token inválido: 404', async () => {
      const { service } = setup();
      await expect(service.getLinkView('x'.repeat(24))).rejects.toThrow('Enlace no válido');
    });
  });

  describe('remind (reenviar SMS)', () => {
    const old = () => new Date(Date.now() - 11 * 60 * 1000);

    it('el Admin Papel reenvía su solicitud pendiente a todos los admins', async () => {
      const rows = [pendingRow({ createdAt: old() })];
      const { service, smsTo } = setup(rows);
      const res = await service.remind('10', diego as any);
      expect(res).toMatchObject({ ok: true, code: 'A12', sentTo: 2, remindCount: 1 });
      expect(smsTo(felix.phoneNumber)[0]).toContain('recordatorio');
      expect(smsTo(ana.phoneNumber)[0]).toContain('A12');
      expect(rows[0].lastRemindedAt).toBeInstanceOf(Date);
    });

    it('no deja reenviar antes de 10 minutos', async () => {
      const rows = [pendingRow({ createdAt: new Date() })];
      const { service, textBee } = setup(rows);
      await expect(service.remind('10', diego as any)).rejects.toThrow(/Puedes volver a enviarla en/);
      expect(textBee.sendSMS).not.toHaveBeenCalled();
    });

    it('solo solicitudes propias y pendientes', async () => {
      const { service } = setup([pendingRow({ createdAt: old(), status: 'rejected' })]);
      await expect(service.remind('10', diego as any)).rejects.toThrow('ya no está pendiente');
      await expect(service.remind('10', felix as any)).rejects.toThrow('Solo el Admin Papel');
      const other = setup([pendingRow({ createdAt: old(), userId: '77' })]);
      await expect(other.service.remind('10', diego as any)).rejects.toThrow('no encontrada');
    });
  });

  describe('expirePending', () => {
    it('expira las pendientes viejas y avisa al solicitante', async () => {
      const old = new Date(Date.now() - 49 * 3600 * 1000);
      const rows = [pendingRow({ createdAt: old }), pendingRow({ id: '11', code: 'B3' })];
      const { service, pendingRepo, smsTo } = setup(rows);
      pendingRepo.find.mockImplementationOnce(async () => [{ ...rows[0], user: diego }]);

      expect(await service.expirePending()).toBe(1);
      expect(rows[0].status).toBe('expired');
      expect(rows[1].status).toBe('pending');
      expect(smsTo(diego.phoneNumber)[0]).toContain('A12');
    });
  });
});
