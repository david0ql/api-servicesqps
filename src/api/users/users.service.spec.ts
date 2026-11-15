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
