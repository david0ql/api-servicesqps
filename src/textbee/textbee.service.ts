import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import envVars from '../config/env';

/** Espacio mínimo entre envíos y esperas ante 429/5xx. El gateway de TextBee
 *  limita la frecuencia: cuando el cron semanal crea muchos servicios a la vez,
 *  los SMS en ráfaga recibían 429 y se perdían (ej. 22-nov a las 6 PM). */
export const SMS_MIN_GAP_MS = 400;
export const SMS_RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const isRetryableSmsError = (error: any): boolean => {
    const status = error?.response?.status;
    if (status === 429) return true;
    if (typeof status === 'number') return status >= 500;
    return !!error?.code || !error?.response; // error de red/timeout
};

export const retryAfterMs = (error: any, fallback: number): number => {
    const raw = error?.response?.headers?.['retry-after'];
    const secs = Number(raw);
    return Number.isFinite(secs) && secs > 0 ? Math.min(secs * 1000, 60000) : fallback;
};

@Injectable()
export class TextBeeService {
    private readonly logger = new Logger(TextBeeService.name);
    private readonly apiUrl = 'https://api-textbee.servicesqps.com/api/v1/gateway/devices';
    private readonly apiKey: string;
    private readonly deviceId: string;
    /** Cola: los envíos salen de a uno, con SMS_MIN_GAP_MS entre ellos. */
    private queue: Promise<unknown> = Promise.resolve();
    private lastSentAt = 0;
    /** Inyectable en tests para no esperar de verdad. */
    sleep: (ms: number) => Promise<void> = sleep;

    constructor() {
        this.apiKey = envVars.TEXTBEE_API_KEY;
        this.deviceId = envVars.TEXTBEE_DEVICE_ID;
    }

    sendSMS(phoneNumber: string, message: string): Promise<boolean> {
        const run = this.queue.then(() => this.sendWithRetry(phoneNumber, message));
        this.queue = run.catch(() => undefined);
        return run;
    }

    private async sendWithRetry(phoneNumber: string, message: string): Promise<boolean> {
        for (let attempt = 0; ; attempt++) {
            const wait = SMS_MIN_GAP_MS - (Date.now() - this.lastSentAt);
            if (wait > 0) await this.sleep(wait);
            const outcome = await this.sendOnce(phoneNumber, message, attempt < SMS_RETRY_DELAYS_MS.length);
            this.lastSentAt = Date.now();
            if (outcome !== 'retry') return outcome;
            const delay = retryAfterMs(this.lastError, SMS_RETRY_DELAYS_MS[attempt]);
            this.logger.warn(`SMS a ${phoneNumber} rechazado (${this.lastError?.response?.status ?? this.lastError?.code ?? 'error'}), reintento ${attempt + 1} en ${delay} ms`);
            await this.sleep(delay);
        }
    }

    private lastError: any;

    private async sendOnce(phoneNumber: string, message: string, canRetry: boolean): Promise<boolean | 'retry'> {
        try {
            // Basic phone number validation
            if (!phoneNumber || !phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
                this.logger.warn(`Invalid phone number format: ${phoneNumber}`);
                return false;
            }

            // Ensure phone number starts with +
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

            const url = `${this.apiUrl}/${this.deviceId}/send-sms`;
            
            const response = await axios.post(
                url,
                {
                    recipients: [formattedPhone],
                    message: message,
                },
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.data?.data?.success) {
                this.logger.log(
                    `SMS sent successfully to ${formattedPhone}, SMS Batch ID: ${response.data.data.smsBatchId}`
                );
                return true;
            } else {
                this.logger.error(`Failed to send SMS to ${formattedPhone}: Unexpected response`, response.data);
                return false;
            }
        } catch (error) {
            if (canRetry && isRetryableSmsError(error)) {
                this.lastError = error;
                return 'retry';
            }
            this.logger.error(
                `Failed to send SMS to ${phoneNumber}: ${error.message}`,
                {
                    error: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
                }
            );
            return false;
        }
    }
}

