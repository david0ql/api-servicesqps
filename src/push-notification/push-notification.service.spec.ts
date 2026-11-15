jest.mock('../config/env', () => ({
  __esModule: true,
  default: { ENABLE_NOTIFICATIONS: true, EXPO_ACCESS_TOKEN: 'test' },
}));
jest.mock('../textbee/textbee.service', () => ({ TextBeeService: class { } }));

import { PushNotificationsService } from './push-notification.service';

describe('PushNotificationsService skipSms', () => {
  const createService = () => {
    const textBeeService = { sendSMS: jest.fn(async () => true) };
    const service = new PushNotificationsService(textBeeService as any);
    const sendPush = jest.fn(async () => []);
    (service as any).expo = {
      chunkPushNotifications: (messages: any[]) => [messages],
      sendPushNotificationsAsync: sendPush,
    };
    return { service, textBeeService, sendPush };
  };

  const users = [{ id: '1', name: 'A', phoneNumber: '+10000000000' }] as any;
  const tokens = ['ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'];

  it('sends push but no SMS when skipSms is true', async () => {
    const { service, textBeeService, sendPush } = createService();

    await service.sendNotification({ title: 't', body: 'b', tokensNotification: { tokens, users }, skipSms: true });

    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(textBeeService.sendSMS).not.toHaveBeenCalled();
  });

  it('keeps sending SMS by default', async () => {
    const { service, textBeeService } = createService();

    await service.sendNotification({ title: 't', body: 'b', tokensNotification: { tokens, users } });

    expect(textBeeService.sendSMS).toHaveBeenCalledWith('+10000000000', 'b');
  });
});
