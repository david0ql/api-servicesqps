import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NewsEntity } from '../../entities/news.entity';
import { NewsReadsEntity } from '../../entities/news_reads.entity';
import { UsersEntity } from '../../entities/users.entity';
import { NotificationsModule } from '../../push-notification/push-notification.module';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    TypeOrmModule.forFeature([NewsEntity, NewsReadsEntity, UsersEntity]),
  ],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule { }
