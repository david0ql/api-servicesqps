import { Brackets } from 'typeorm';

import { UsersService } from './users.service';

/** QueryBuilder falso que registra cada llamada encadenada. */
const createQueryBuilderMock = (items: any[] = [], totalCount = 0) => {
  const calls: { method: string; args: any[] }[] = [];
  const qb: any = {};
  for (const method of [
    'innerJoinAndSelect', 'orderBy', 'skip', 'take', 'select', 'where', 'orWhere', 'andWhere',
  ]) {
    qb[method] = jest.fn((...args: any[]) => {
      calls.push({ method, args });
      return qb;
    });
  }
  qb.getManyAndCount = jest.fn(async () => [items, totalCount]);
  return { qb, calls };
};

const createService = (qb: any) => {
  const usersRepository = { createQueryBuilder: jest.fn(() => qb) };
  const rolesRepository = { find: jest.fn() };
  const service = new UsersService(rolesRepository as any, usersRepository as any);
  return { service, usersRepository };
};

const pageOptions = (extra: Record<string, any> = {}) =>
  ({ page: 1, take: 10, skip: 0, order: 'DESC', ...extra }) as any;

describe('UsersService.searchByWord', () => {
  it('agrupa los LIKE entre parentesis y aplica el rol con AND', async () => {
    const { qb, calls } = createQueryBuilderMock([{ id: 'u1' }], 1);
    const { service } = createService(qb);

    const result = await service.searchByWord({ searchWord: 'ana' }, pageOptions({ roleId: '4' }));

    const whereCalls = calls.filter((c) => ['where', 'orWhere', 'andWhere'].includes(c.method));
    // Nivel superior: un solo where (los Brackets) + andWhere del rol; ningun orWhere suelto.
    expect(whereCalls.map((c) => c.method)).toEqual(['where', 'andWhere']);
    expect(whereCalls[0].args[0]).toBeInstanceOf(Brackets);
    expect(whereCalls[1].args).toEqual(['users.roleId = :roleId', { roleId: '4' }]);

    // Dentro de los Brackets van los cuatro LIKE.
    const inner = createQueryBuilderMock();
    (whereCalls[0].args[0] as Brackets).whereFactory(inner.qb);
    expect(inner.calls.map((c) => c.method)).toEqual(['where', 'orWhere', 'orWhere', 'orWhere']);
    expect(inner.calls.map((c) => c.args[0])).toEqual([
      'users.name LIKE :searchWord',
      'users.email LIKE :searchWord',
      'users.phoneNumber LIKE :searchWord',
      'role.name LIKE :searchWord',
    ]);
    expect(inner.calls[0].args[1]).toEqual({ searchWord: '%ana%' });

    expect(result.data).toEqual([{ id: 'u1' }]);
    expect(result.meta.totalCount).toBe(1);
  });

  it('sin roleId no agrega filtro de rol', async () => {
    const { qb, calls } = createQueryBuilderMock();
    const { service } = createService(qb);

    await service.searchByWord({ searchWord: 'ana' }, pageOptions());

    expect(calls.some((c) => c.method === 'andWhere')).toBe(false);
    expect(calls.some((c) => c.method === 'orWhere')).toBe(false);
  });
});

describe('UsersService.findAll', () => {
  it('filtra por roleId cuando se envia', async () => {
    const { qb } = createQueryBuilderMock();
    const { service } = createService(qb);

    await service.findAll(pageOptions({ roleId: '6' }));

    expect(qb.andWhere).toHaveBeenCalledWith('user.roleId = :roleId', { roleId: '6' });
  });

  it('sin roleId no filtra por rol', async () => {
    const { qb } = createQueryBuilderMock();
    const { service } = createService(qb);

    await service.findAll(pageOptions());

    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('UsersService filtro por estado (activo/inactivo)', () => {
  it.each([
    ['active', true],
    ['inactive', false],
  ])('findAll con status=%s filtra isActive=%s', async (status, isActive) => {
    const { qb } = createQueryBuilderMock();
    const { service } = createService(qb);
    await service.findAll(pageOptions({ status }));
    expect(qb.andWhere).toHaveBeenCalledWith('user.isActive = :isActive', { isActive });
  });

  it.each([
    ['active', true],
    ['inactive', false],
  ])('searchByWord con status=%s filtra isActive=%s', async (status, isActive) => {
    const { qb } = createQueryBuilderMock();
    const { service } = createService(qb);
    await service.searchByWord({ searchWord: 'ana' } as any, pageOptions({ status }));
    expect(qb.andWhere).toHaveBeenCalledWith('users.isActive = :isActive', { isActive });
  });

  it('status=all no filtra por estado (lista y búsqueda)', async () => {
    const a = createQueryBuilderMock(); await createService(a.qb).service.findAll(pageOptions({ status: 'all' }));
    expect(a.qb.andWhere).not.toHaveBeenCalled();
    const b = createQueryBuilderMock(); await createService(b.qb).service.searchByWord({ searchWord: 'x' } as any, pageOptions({ status: 'all' }));
    expect(b.qb.andWhere).not.toHaveBeenCalled();
  });

  it('sin status no filtra por estado', async () => {
    const { qb } = createQueryBuilderMock();
    const { service } = createService(qb);
    await service.findAll(pageOptions());
    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});

describe('UsersService.findAllRoles', () => {
  it('no ofrece el rol Cheo (retirado)', async () => {
    const rolesRepository = { find: jest.fn(async () => [{ id: '1', name: 'super_admin' }, { id: '5', name: 'Cheo' }, { id: '6', name: 'Supervisor' }]) };
    const service = new UsersService(rolesRepository as any, {} as any);
    expect((await service.findAllRoles()).map((r: any) => r.id)).toEqual(['1', '6']);
  });
});

describe('UsersService push token', () => {
  const VALID = 'ExponentPushToken[abc123]';

  const setup = () => {
    const txRepo = { update: jest.fn(async () => ({ affected: 1 })) };
    const manager = {
      getRepository: jest.fn(() => txRepo),
      transaction: jest.fn(async (cb: any) => cb(manager)),
    };
    const usersRepository = { manager, update: jest.fn(async () => ({ affected: 1 })) };
    const service = new UsersService({} as any, usersRepository as any);
    return { service, usersRepository, txRepo, manager };
  };

  it('quita el token a los demás usuarios y se lo asigna al usuario activo', async () => {
    const { service, txRepo, manager } = setup();

    await expect(service.assignPushToken('7', ` ${VALID} `)).resolves.toEqual({ ok: true });

    expect(manager.transaction).toHaveBeenCalledTimes(1);
    expect(txRepo.update).toHaveBeenCalledTimes(2);
    const [clearWhere, clearSet] = (txRepo.update.mock.calls[0] as any[]);
    expect(clearWhere.token).toBe(VALID);
    // Not('7'): todos menos el propio usuario.
    expect(clearWhere.id).toMatchObject({ _type: 'not', _value: '7' });
    expect(clearSet).toEqual({ token: '' });
    expect(txRepo.update.mock.calls[1]).toEqual([{ id: '7' }, { token: VALID }]);
  });

  it('rechaza tokens que no son de Expo', async () => {
    const { service, manager } = setup();
    await expect(service.assignPushToken('7', 'Error: permission denied')).rejects.toThrow('Invalid Expo push token');
    await expect(service.assignPushToken('7', '')).rejects.toThrow();
    expect(manager.transaction).not.toHaveBeenCalled();
  });

  it('al cerrar sesión solo limpia el token si coincide con el del dispositivo', async () => {
    const { service, usersRepository } = setup();
    await service.clearPushToken('7', VALID);
    expect(usersRepository.update).toHaveBeenCalledWith({ id: '7', token: VALID }, { token: '' });

    usersRepository.update.mockClear();
    await service.clearPushToken('7', undefined);
    expect(usersRepository.update).not.toHaveBeenCalled();
  });
});
