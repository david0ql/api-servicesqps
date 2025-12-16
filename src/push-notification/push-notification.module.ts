import { Module } from '@nestjs/common';
import { PushNotificationsService } from './push-notification.service';
import { TextBeeModule } from '../textbee/textbee.module';

@Module({
  imports: [TextBeeModule],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})

export class NotificationsModule { }
