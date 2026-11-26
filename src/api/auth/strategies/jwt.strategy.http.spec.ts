jest.mock('src/config/env', () => ({ __esModule: true, default: { JWT_SECRET: 'test-secret' } }));

import { Controller, Get, INestApplication, Post, UseGuards } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthGuard, PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtStrategy } from './jwt.strategy';
import { UsersEntity } from 'src/entities/users.entity';

@Controller()
class FakeController {
  @Get('services/by-user/:id')
  @UseGuards(AuthGuard('jwt'))
  services() { return { ok: 'services' }; }

  @Get('auth/me')
  @UseGuards(AuthGuard('jwt'))
  me() { return { ok: 'me' }; }

  @Post('auth/change-password')
  @UseGuards(AuthGuard('jwt'))
  change() { return { ok: 'change' }; }
}

describe('JwtStrategy + AuthGuard (HTTP): cambio de clave obligatorio', () => {
  let app: INestApplication;
  let token: string;
  const users: Record<string, any> = {
    '3': { id: '3', isActive: true, password: 'h', mustChangePassword: true },
    '4': { id: '4', isActive: true, password: 'h', mustChangePassword: false },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({ secret: 'test-secret' })],
      controllers: [FakeController],
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(UsersEntity), useValue: { findOne: async ({ where: { id } }) => ({ ...users[id] }) } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    token = moduleRef.get(JwtService).sign({ id: '3', email: 'x' });
  });

  afterAll(async () => app.close());

  it('bloquea endpoints de datos con 403 y code PASSWORD_CHANGE_REQUIRED', async () => {
    const res = await request(app.getHttpServer()).get('/services/by-user/3').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Debes cambiar tu clave. Actualiza la app si no ves la opción.',
    });
  });

  it('deja pasar /auth/me y /auth/change-password', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    const change = await request(app.getHttpServer()).post('/auth/change-password').set('Authorization', `Bearer ${token}`);
    expect(change.status).toBe(201);
  });

  it('sin la marca todo pasa', async () => {
    const moduleToken = (app.get(JwtService) as JwtService).sign({ id: '4', email: 'y' });
    const res = await request(app.getHttpServer()).get('/services/by-user/4').set('Authorization', `Bearer ${moduleToken}`);
    expect(res.status).toBe(200);
  });
});
