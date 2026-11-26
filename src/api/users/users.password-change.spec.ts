import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { UsersService } from './users.service';

const createService = (role: any = { id: '4', name: 'Cleaner' }) => {
  const calls: { method: string; args: any[] }[] = [];
  const qb: any = {};
  for (const method of ['update', 'set', 'where', 'andWhere']) {
    qb[method] = jest.fn((...args: any[]) => { calls.push({ method, args }); return qb; });
  }
  qb.execute = jest.fn(async () => ({ affected: 12 }));
  const usersRepository = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(async ({ where: { id } }) => (id === '404' ? null : { id })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const rolesRepository = { findOne: jest.fn(async () => role) };
  const service = new UsersService(rolesRepository as any, usersRepository as any);
  return { service, usersRepository, calls };
};

const admin = { id: '1', roleId: '1' } as any;

describe('UsersService - pedir cambio de clave', () => {
  it('marca a los activos del rol, sin incluir al admin que lo pide', async () => {
    const { service, calls } = createService();
    const result = await service.requirePasswordChangeForRole('4', admin);

    expect(result).toEqual({ roleId: '4', roleName: 'Cleaner', affected: 12 });
    expect(calls.find((c) => c.method === 'set')!.args[0]).toEqual({ mustChangePassword: true });
    expect(calls.find((c) => c.method === 'where')!.args).toEqual(['role_id = :roleId', { roleId: '4' }]);
    const andWheres = calls.filter((c) => c.method === 'andWhere').map((c) => c.args);
    expect(andWheres).toEqual([
      ['is_active = :isActive', { isActive: true }],
      ['id <> :actorId', { actorId: '1' }],
    ]);
  });

  it('rol inexistente: 404', async () => {
    const { service } = createService(null);
    await expect(service.requirePasswordChangeForRole('99', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('solo roles admin (1 y 9) pueden pedirlo', async () => {
    const { service, usersRepository } = createService();
    for (const roleId of ['2', '3', '4', '7', null]) {
      await expect(service.requirePasswordChangeForRole('4', { id: '5', roleId } as any))
        .rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.requirePasswordChange('7', { id: '5', roleId } as any))
        .rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(usersRepository.update).not.toHaveBeenCalled();
    await expect(service.requirePasswordChange('7', { id: '5', roleId: '9' } as any)).resolves.toBeTruthy();
  });

  it('marca y desmarca a un usuario', async () => {
    const { service, usersRepository } = createService();
    await expect(service.requirePasswordChange('7', admin)).resolves.toEqual({ id: '7', mustChangePassword: true });
    expect(usersRepository.update).toHaveBeenLastCalledWith('7', { mustChangePassword: true });
    await expect(service.cancelPasswordChange('7', admin)).resolves.toEqual({ id: '7', mustChangePassword: false });
    expect(usersRepository.update).toHaveBeenLastCalledWith('7', { mustChangePassword: false });
    await expect(service.requirePasswordChange('404', admin)).rejects.toBeInstanceOf(NotFoundException);
  });
});
