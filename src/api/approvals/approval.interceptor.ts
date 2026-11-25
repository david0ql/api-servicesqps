import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { Observable } from 'rxjs';

import { SKIP_APPROVAL_KEY } from '../../decorators/skip-approval.decorator';
import { APPROVAL_TOKEN_HEADER, decideApprovalInterception } from './approval-decision.util';
import { ApprovalsService } from './approvals.service';

/** Mismas opciones que el ValidationPipe global de main.ts. */
const prevalidationPipe = new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true, transform: true });

/**
 * Interceptor global (APP_INTERCEPTOR). Corre después de los guards, así que
 * en rutas con AuthGuard('jwt') `req.user.user` ya es el UsersEntity.
 *
 * Para el rol Admin Papel (9), todo POST/PUT/PATCH/DELETE que no tenga
 * @SkipApproval() se guarda en pending_changes y responde 202 sin ejecutar.
 * La re-ejecución aprobada trae x-approval-token y pasa una sola vez.
 */
@Injectable()
export class ApprovalInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApprovalInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly approvalsService: ApprovalsService,
  ) { }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_APPROVAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? false;
    const user = req.user?.user;
    const token = req.headers?.[APPROVAL_TOKEN_HEADER];
    const url: string = req.originalUrl ?? req.url;

    const decision = decideApprovalInterception({ method: req.method, skip, user, approvalToken: token });

    if (decision === 'pass') return next.handle();

    if (decision === 'replay') {
      const tokenValue = Array.isArray(token) ? token[0] : token;
      const ok = await this.approvalsService.consumeReplayToken(String(tokenValue), req.method, url, user.id);
      if (!ok) {
        throw new ForbiddenException('Token de aprobación inválido, ya usado o no corresponde a esta petición.');
      }
      req.approvedReplay = true;
      return next.handle();
    }

    // decision === 'queue'
    const contentType = String(req.headers?.['content-type'] ?? '');
    if (contentType.includes('multipart/form-data')) {
      throw new BadRequestException(
        'Las cargas de archivos no pueden enviarse a aprobación. Pide a un administrador que suba el archivo.',
      );
    }

    await this.prevalidateBody(context, req.body);

    const change = await this.approvalsService.queueRequest({
      method: req.method,
      url,
      body: req.body,
      user,
    });

    // El status del handler (@HttpCode / 201 por defecto) pisaría un res.status
    // puesto aquí; una HttpException con 202 es la forma fiable de responder
    // sin ejecutar el handler. El cliente la recibe como 2xx normal.
    throw new HttpException(
      {
        pendingApproval: true,
        id: change.id,
        code: change.code,
        summary: change.summary,
        message: `Enviado a aprobación (código ${change.code}). Un administrador debe aprobarlo.`,
      },
      HttpStatus.ACCEPTED,
    );
  }

  /**
   * Valida el body con el DTO del endpoint ANTES de crear la solicitud, para
   * que Diego vea el error de validación de inmediato y no tras la aprobación.
   * Se guarda el body original: al re-ejecutar pasa de nuevo por el pipe global.
   */
  private async prevalidateBody(context: ExecutionContext, body: unknown) {
    try {
      const controller = context.getClass();
      const handler = context.getHandler();
      const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler.name) ?? {};
      const paramTypes: unknown[] = Reflect.getMetadata('design:paramtypes', controller.prototype, handler.name) ?? [];

      for (const key of Object.keys(args)) {
        const [type] = key.split(':');
        if (Number(type) !== RouteParamtypes.BODY) continue;
        const { index, data } = args[key];
        const metatype = paramTypes[index] as any;
        const value = data ? (body as any)?.[data] : body;
        await prevalidationPipe.transform(value, { type: 'body', metatype, data });
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.warn(`Prevalidación omitida: ${error.message}`);
    }
  }
}
