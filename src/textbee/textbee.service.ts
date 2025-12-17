import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import envVars from '../config/env';

@Injectable()
export class TextBeeService {
    private readonly logger = new Logger(TextBeeService.name);
    private readonly apiUrl = 'https://api-textbee.servicesqps.com/api/v1/gateway/devices';
    private readonly apiKey: string;
    private readonly deviceId: string;

    constructor() {
        this.apiKey = envVars.TEXTBEE_API_KEY;
        this.deviceId = envVars.TEXTBEE_DEVICE_ID;
    }

    async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
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
            this.logger.error(
                `Failed to send SMS to ${phoneNumber}: ${error.message}`,
                {
                    error: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    stack: error.stack,
                }
            );
            return false;
        }
    }
}

