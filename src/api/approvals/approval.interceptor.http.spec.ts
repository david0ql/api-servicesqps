jest.mock('./approvals.service', () => ({ ApprovalsService: class ApprovalsService {} }));

import { Body, CanActivate, Controller, ExecutionContext, HttpCode, INestApplication, Injectable, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';

import { ApprovalInterceptor } from './approval.interceptor';
import { ApprovalsService } from './approvals.service';

class ThingDto {
  @IsString()
  name: string;
}

/** Simula AuthGuard('jwt'): pone req.user = { user } como jwt.strategy. */
@Injectable()
class FakeJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    req.user = { user: { id: req.headers['x-user-id'], roleId: req.headers['x-role-id'], name: 'Test' } };
    return true;
  }
}

const executed = jest.fn();

@Controller('things')
class ThingsController {
  @Post()
  @UseGuards(FakeJwtGuard)
  create(@Body() dto: ThingDto) { executed(dto); return { created: dto.name }; }

  @Post('ok')
  @HttpCode(200)
  @UseGuards(FakeJwtGuard)
  withCode(@Body() dto: ThingDto) { executed(dto); return { ok: true }; }
}

describe('ApprovalInterceptor (HTTP)', () => {
  let app: INestApplication;
  const approvalsService = {
    queueRequest: jest.fn(async () => ({ id: '7', code: 'A12', summary: 'crear things' })),
    consumeReplayToken: jest.fn(async () => true),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController],
      providers: [
        FakeJwtGuard,
        { provide: ApprovalsService, useValue: approvalsService },
        { provide: APP_INTERCEPTOR, useClass: ApprovalInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => { executed.mockClear(); approvalsService.queueRequest.mockClear(); });

  it('Admin Papel: 202 con pendingApproval y sin ejecutar (aunque el handler tenga @HttpCode)', async () => {
    for (const path of ['/things', '/things/ok']) {
      const res = await request(app.getHttpServer())
        .post(`${path}?a=1`).set('x-user-id', '50').set('x-role-id', '9').send({ name: 'x' });
      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({ pendingApproval: true, code: 'A12' });
    }
    expect(executed).not.toHaveBeenCalled();
    expect(approvalsService.queueRequest).toHaveBeenCalledWith(expect.objectContaining({ url: '/things?a=1', method: 'POST' }));
  });

  it('super admin: ejecuta normal', async () => {
    const res = await request(app.getHttpServer())
      .post('/things').set('x-user-id', '1').set('x-role-id', '1').send({ name: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 'x' });
    expect(executed).toHaveBeenCalledTimes(1);
  });

  it('re-ejecución con token: ejecuta', async () => {
    const res = await request(app.getHttpServer())
      .post('/things').set('x-user-id', '50').set('x-role-id', '9').set('x-approval-token', 'tok').send({ name: 'x' });
    expect(res.status).toBe(201);
    expect(executed).toHaveBeenCalledTimes(1);
  });

  it('Admin Papel con body inválido: 400 inmediato', async () => {
    const res = await request(app.getHttpServer())
      .post('/things').set('x-user-id', '50').set('x-role-id', '9').send({ name: 1 });
    expect(res.status).toBe(400);
    expect(approvalsService.queueRequest).not.toHaveBeenCalled();
  });
});
