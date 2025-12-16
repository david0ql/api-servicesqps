import { Module } from '@nestjs/common';
import { TextBeeService } from './textbee.service';

@Module({
  providers: [TextBeeService],
  exports: [TextBeeService],
})
export class TextBeeModule { }

