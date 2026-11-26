jest.mock('src/config/env', () => ({ __esModule: true, default: { JWT_SECRET: 'test' } }));

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { JwtStrategy } from './jwt.strategy';

const createStrategy = (user: any) => {
  const repo = { findOne: jest.fn(async () => (user ? { ...user } : null)) };
  return new JwtStrategy(repo as any);
};

describe('JwtStrategy.validate (cambio de clave obligatorio)', () => {
  it('usuario normal pasa y no expone la clave', async () => {
    const strategy = createStrategy({ id: '3', isActive: true, password: 'hash', mustChangePassword: false });
    const result = await strategy.validate({ method: 'GET', originalUrl: '/services' }, { id: '3', email: 'a@b.c' });
    expect(result.user.id).toBe('3');
    expect(result.user.password).toBeUndefined();
  });

  it('usuario inactivo: 401', async () => {
    const strategy = createStrategy({ id: '3', isActive: false, password: 'hash' });
    await expect(strategy.validate({ method: 'GET', originalUrl: '/services' }, { id: '3', email: '' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('con la marca: 403 PASSWORD_CHANGE_REQUIRED en endpoints de datos', async () => {
    const strategy = createStrategy({ id: '3', isActive: true, password: 'hash', mustChangePassword: true });
    const promise = strategy.validate({ method: 'GET', originalUrl: '/services/by-user/3?page=1' }, { id: '3', email: '' });
    await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
    await promise.catch((error: ForbiddenException) => {
      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'PASSWORD_CHANGE_REQUIRED' }));
    });
  });

  it('con la marca: deja pasar /auth/me y /auth/change-password', async () => {
    const strategy = createStrategy({ id: '3', isActive: true, password: 'hash', mustChangePassword: true });
    await expect(strategy.validate({ method: 'GET', originalUrl: '/auth/me' }, { id: '3', email: '' }))
      .resolves.toEqual({ user: expect.objectContaining({ id: '3' }) });
    await expect(strategy.validate({ method: 'POST', originalUrl: '/auth/change-password' }, { id: '3', email: '' }))
      .resolves.toEqual({ user: expect.objectContaining({ id: '3' }) });
  });
});
