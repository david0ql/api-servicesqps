import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';

import envVars from '../../config/env';
import { APPROVAL_TOKEN_HEADER } from './approval-decision.util';

export interface ReplayRequest {
  method: string;
  /** Path + query tal como se guardó (req.originalUrl). */
  url: string;
  body: unknown;
  user: { id: string; email: string };
  /** Token de un solo uso en claro (en BD solo queda su hash). */
  approvalToken: string;
}

export interface ReplayResult {
  status: number;
  body: unknown;
}

/**
 * Re-ejecuta la petición original contra el propio API, autenticada como el
 * Admin Papel (JWT recién firmado, 5 minutos) y con x-approval-token para que
 * el ApprovalInterceptor la deje pasar una sola vez. Así se reutilizan los
 * mismos guards, pipes de validación y lógica de negocio del endpoint.
 */
@Injectable()
export class ApprovalExecutorService {
  private readonly logger = new Logger(ApprovalExecutorService.name);

  constructor(private readonly jwtService: JwtService) { }

  baseUrl(): string {
    const configured = (envVars.APPROVAL_REPLAY_BASE_URL ?? '').trim();
    return (configured || `http://127.0.0.1:${envVars.PORT}`).replace(/\/+$/, '');
  }

  async replay(request: ReplayRequest): Promise<ReplayResult> {
    const jwt = this.jwtService.sign(
      { id: request.user.id, email: request.user.email },
      { expiresIn: '5m' },
    );
    const url = `${this.baseUrl()}${request.url.startsWith('/') ? '' : '/'}${request.url}`;

    try {
      const response = await axios.request({
        method: request.method as any,
        url,
        data: request.body ?? undefined,
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          [APPROVAL_TOKEN_HEADER]: request.approvalToken,
        },
        timeout: 120_000,
        validateStatus: () => true,
      });
      return { status: response.status, body: response.data };
    } catch (error) {
      this.logger.error(`Replay ${request.method} ${request.url} falló: ${error.message}`);
      return { status: 0, body: { message: `No se pudo contactar al API: ${error.message}` } };
    }
  }
}
