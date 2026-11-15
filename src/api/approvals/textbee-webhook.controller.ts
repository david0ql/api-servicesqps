import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import envVars from '../../config/env';
import { SkipApproval } from '../../decorators/skip-approval.decorator';
import { verifyTextBeeSignature } from '../../textbee/textbee-signature.util';
import { ApprovalsService } from './approvals.service';

const MAX_REMEMBERED_DELIVERIES = 500;

/**
 * Webhook de TextBee (evento MESSAGE_RECEIVED). Payload:
 *   { smsId, message, deviceId, webhookSubscriptionId, webhookEvent,
 *     idempotencyKey, sender, receivedAt }
 * Firmado con el "signing secret" de la suscripción (TEXTBEE_WEBHOOK_SECRET).
 * El body NO pasa por el ValidationPipe whitelisted: se recibe como objeto
 * plano (`any`), y la firma se verifica sobre el body crudo (rawBody).
 */
@ApiExcludeController()
@Controller('textbee')
@SkipApproval()
export class TextBeeWebhookController {
  private readonly logger = new Logger(TextBeeWebhookController.name);
  /** TextBee reintenta con el mismo idempotencyKey: no procesar dos veces. */
  private readonly seen = new Map<string, number>();

  constructor(private readonly approvalsService: ApprovalsService) { }

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req() req: any,
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
    @Headers('x-textbee-signature') timestampedSignature?: string,
  ) {
    const secret = envVars.TEXTBEE_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn('Webhook de TextBee recibido pero TEXTBEE_WEBHOOK_SECRET no está configurado.');
      throw new ServiceUnavailableException('Webhook not configured');
    }

    const raw: Buffer | string = req.rawBody ?? JSON.stringify(payload ?? {});
    if (!verifyTextBeeSignature(secret, raw, { signature, timestampedSignature })) {
      this.logger.warn('Webhook de TextBee con firma inválida.');
      throw new UnauthorizedException('Invalid signature');
    }

    if (payload?.webhookEvent && payload.webhookEvent !== 'MESSAGE_RECEIVED') {
      return { ok: true, ignored: payload.webhookEvent };
    }

    const sender = String(payload?.sender ?? '');
    const message = String(payload?.message ?? '');
    if (!sender || !message) return { ok: true, ignored: 'empty' };

    const deliveryKey = String(payload?.idempotencyKey ?? payload?.smsId ?? '');
    if (deliveryKey) {
      if (this.seen.has(deliveryKey)) return { ok: true, duplicate: true };
      this.remember(deliveryKey);
    }

    const result = await this.approvalsService.handleInboundSms(sender, message);
    return { ok: true, result };
  }

  private remember(key: string) {
    this.seen.set(key, Date.now());
    if (this.seen.size > MAX_REMEMBERED_DELIVERIES) {
      const oldest = this.seen.keys().next().value;
      if (oldest) this.seen.delete(oldest);
    }
  }
}
