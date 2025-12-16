import {
    Injectable,
    Logger,
} from '@nestjs/common';

import { Expo, ExpoPushMessage } from 'expo-server-sdk';

import { UsersEntity } from '../entities/users.entity';
import envVars from '../config/env';
import { TextBeeService } from '../textbee/textbee.service';

export interface TokensNotification {
    tokens: string[];
    users: UsersEntity[];
}

export interface PushNotification {
    body: string;
    title: string;
    data?: Record<string, any>;
    sound?: string;
    tokensNotification: TokensNotification;
}

@Injectable()
export class PushNotificationsService {
    private readonly logger = new Logger(PushNotificationsService.name);

    constructor(
        private readonly textBeeService: TextBeeService,
    ) { }

    private expo = new Expo({
        accessToken: envVars.EXPO_ACCESS_TOKEN,
        useFcmV1: true,
    });

    private async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
        return await this.textBeeService.sendSMS(phoneNumber, message);
    }

    async sendNotification(pushNotification: PushNotification) {
        if (!envVars.ENABLE_NOTIFICATIONS) {
            return {
                done: true,
            };
        }

        // Handle Expo push notifications
        const areExpoTokens = pushNotification.tokensNotification.tokens.every(Expo.isExpoPushToken);
        if (areExpoTokens) {
            const messages: ExpoPushMessage[] = pushNotification.tokensNotification.tokens.map((token) => ({
                to: token,
                sound: pushNotification.sound || 'default',
                body: pushNotification.body,
                title: pushNotification.title,
                data: pushNotification.data,
            }));

            const chunks = this.expo.chunkPushNotifications(messages);
            const tickets = [];

            for (const chunk of chunks) {
                try {
                    const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                    tickets.push(ticketChunk);
                } catch (error) {
                    this.logger.error('Error sending push notification:', error);
                }
            }
        }

        // Handle SMS notifications
        const smsResults = await Promise.all(
            pushNotification.tokensNotification.users.map(async user => {
                const result = await this.sendSMS(user.phoneNumber, pushNotification.body);
                if (!result) {
                    this.logger.warn(`Failed to send SMS to user ${user.id} (${user.name}) with phone ${user.phoneNumber}`);
                }
                return result;
            })
        );

        const failedSMS = smsResults.filter(result => !result).length;
        if (failedSMS > 0) {
            this.logger.warn(`${failedSMS} SMS messages failed to send`);
        }

        return {
            done: true,
            smsSent: smsResults.filter(result => result).length,
            smsFailed: failedSMS,
        };
    }
}