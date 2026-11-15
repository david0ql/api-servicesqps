jest.mock('./approvals.service', () => ({ ApprovalsService: class ApprovalsService {} }));

import { Body, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IsString } from 'class-validator';
import { lastValueFrom, of } from 'rxjs';

import { SkipApproval } from '../../decorators/skip-approval.decorator';
import { ApprovalInterceptor } from './approval.interceptor';

class CreateThingDto {
  @IsString()
  name: string;
}

class ThingsController {
  create(@Body() dto: CreateThingDto) { return dto; }

  @SkipApproval()
  search(@Body() dto: CreateThingDto) { return dto; }
}

const papel = { id: '50', roleId: '9', name: 'Diego' };
const admin = { id: '1', roleId: '1', name: 'Felix' };

const makeContext = (opts: { method: string; handler: keyof ThingsController; user?: any; body?: any; headers?: any; url?: string }) => {
  const req = {
    method: opts.method,
    originalUrl: opts.url ?? '/things?x=1',
    body: opts.body ?? { name: 'cosa' },
    headers: opts.headers ?? { 'content-type': 'application/json' },
    user: opts.user ? { user: opts.user } : undefined,
  };
  return {
    getType: () => 'http',
    getClass: () => ThingsController,
    getHandler: () => ThingsController.prototype[opts.handler],
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
};

const setup = () => {
  const approvalsService = {
    queueRequest: jest.fn(async () => ({ id: '7', code: 'A12', summary: 'crear things' })),
    consumeReplayToken: jest.fn(async () => true),
  };
  const interceptor = new ApprovalInterceptor(new Reflector(), approvalsService as any);
  const next = { handle: jest.fn(() => of('handled')) };
  return { interceptor, approvalsService, next };
};

describe('ApprovalInterceptor', () => {
  it('ejecuta normal a un super admin', async () => {
    const { interceptor, next, approvalsService } = setup();
    const out = await interceptor.intercept(makeContext({ method: 'POST', handler: 'create', user: admin }), next);
    expect(await lastValueFrom(out)).toBe('handled');
    expect(approvalsService.queueRequest).not.toHaveBeenCalled();
  });

  it('ejecuta normal un GET del Admin Papel', async () => {
    const { interceptor, next } = setup();
    const out = await interceptor.intercept(makeContext({ method: 'GET', handler: 'create', user: papel }), next);
    expect(await lastValueFrom(out)).toBe('handled');
  });

  it('respeta @SkipApproval()', async () => {
    const { interceptor, next } = setup();
    const out = await interceptor.intercept(makeContext({ method: 'POST', handler: 'search', user: papel }), next);
    expect(await lastValueFrom(out)).toBe('handled');
  });

  it('encola el POST del Admin Papel y responde 202 sin ejecutar', async () => {
    const { interceptor, next, approvalsService } = setup();
    let error: HttpException | undefined;
    try {
      await interceptor.intercept(makeContext({ method: 'POST', handler: 'create', user: papel }), next);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect(error!.getStatus()).toBe(HttpStatus.ACCEPTED);
    expect(error!.getResponse()).toMatchObject({ pendingApproval: true, code: 'A12', id: '7' });
    expect(next.handle).not.toHaveBeenCalled();
    expect(approvalsService.queueRequest).toHaveBeenCalledWith({
      method: 'POST', url: '/things?x=1', body: { name: 'cosa' }, user: papel,
    });
  });

  it('valida el body antes de encolar', async () => {
    const { interceptor, next, approvalsService } = setup();
    await expect(
      interceptor.intercept(makeContext({ method: 'POST', handler: 'create', user: papel, body: { name: 5, extra: 1 } }), next),
    ).rejects.toMatchObject({ status: 400 });
    expect(approvalsService.queueRequest).not.toHaveBeenCalled();
  });

  it('rechaza multipart', async () => {
    const { interceptor, next } = setup();
    await expect(interceptor.intercept(makeContext({
      method: 'POST', handler: 'create', user: papel, headers: { 'content-type': 'multipart/form-data; boundary=x' },
    }), next)).rejects.toMatchObject({ status: 400 });
  });

  it('deja pasar la re-ejecución con token válido', async () => {
    const { interceptor, next, approvalsService } = setup();
    const out = await interceptor.intercept(makeContext({
      method: 'PATCH', handler: 'create', user: papel, headers: { 'x-approval-token': 'tok' }, url: '/things/1',
    }), next);
    expect(await lastValueFrom(out)).toBe('handled');
    expect(approvalsService.consumeReplayToken).toHaveBeenCalledWith('tok', 'PATCH', '/things/1', '50');
  });

  it('bloquea la re-ejecución con token inválido', async () => {
    const { interceptor, next, approvalsService } = setup();
    approvalsService.consumeReplayToken.mockResolvedValueOnce(false);
    await expect(interceptor.intercept(makeContext({
      method: 'PATCH', handler: 'create', user: papel, headers: { 'x-approval-token': 'bad' },
    }), next)).rejects.toMatchObject({ status: 403 });
    expect(next.handle).not.toHaveBeenCalled();
  });
});
