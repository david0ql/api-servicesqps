jest.mock('../../config/env', () => ({ __esModule: true, default: { ENABLE_NOTIFICATIONS: false } }));

import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';

const createService = async (plainPassword = '1234', extra: Record<string, any> = {}) => {
  const stored = {
    id: '9', email: 'c@qps.com', name: 'Cleaner', roleId: '4', isActive: true,
    password: await bcrypt.hash(plainPassword, 4), mustChangePassword: true, ...extra,
  };
  const usersRepository = {
    findOne: jest.fn(async () => ({ ...stored })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const service = new AuthService(usersRepository as any, { sendNotification: jest.fn() } as any);
  return { service, usersRepository };
};

describe('AuthService.changePassword', () => {
  it('cambia la clave, quita la marca y guarda passwordChangedAt', async () => {
    const { service, usersRepository } = await createService('1234');
    const result = await service.changePassword('9', { currentPassword: '1234', newPassword: '5678' });

    expect(result.ok).toBe(true);
    expect(result.mustChangePassword).toBe(false);
    expect(usersRepository.update).toHaveBeenCalledTimes(1);
    const [id, patch] = usersRepository.update.mock.calls[0] as any[];
    expect(id).toBe('9');
    expect(patch.mustChangePassword).toBe(false);
    expect(patch.passwordChangedAt).toBeInstanceOf(Date);
    expect(await bcrypt.compare('5678', patch.password)).toBe(true);
  });

  it('rechaza si la clave actual es incorrecta', async () => {
    const { service, usersRepository } = await createService('1234');
    await expect(service.changePassword('9', { currentPassword: '0000', newPassword: '5678' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(usersRepository.update).not.toHaveBeenCalled();
  });

  it('rechaza si la nueva es igual a la actual', async () => {
    const { service, usersRepository } = await createService('1234');
    await expect(service.changePassword('9', { currentPassword: '1234', newPassword: '1234' }))
      .rejects.toThrow('distinta');
    expect(usersRepository.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.me', () => {
  it('devuelve la marca como booleano', async () => {
    const { service } = await createService();
    expect(service.me({ id: '9', email: 'e', name: 'n', roleId: '4', mustChangePassword: 1 } as any))
      .toEqual({ id: '9', email: 'e', name: 'n', roleId: '4', mustChangePassword: true });
  });
});

describe('AuthService.login', () => {
  it('incluye mustChangePassword en el usuario devuelto', async () => {
    const { service } = await createService('1234');
    const result = await service.login({ username: 'c@qps.com', password: '1234' } as any);
    expect(result.message.mustChangePassword).toBe(true);
    expect((result.message as any).password).toBeUndefined();
  });
});
