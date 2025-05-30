import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';

import { JwtStrategy } from './strategies/jwt.strategy';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import envVars from '../../config/env';
import { UsersEntity } from '../../entities/users.entity';
import { PushNotificationsService } from '../../push-notification/push-notification.service';
import { NotificationsModule } from '../../push-notification/push-notification.module';


@Module({
  providers: [JwtStrategy, AuthService],
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.register({
      secret: envVars.JWT_SECRET,
      signOptions: { expiresIn: '365d' },
    }),
    TypeOrmModule.forFeature([UsersEntity]),
    NotificationsModule,
  ],
  controllers: [AuthController],
  exports: [JwtStrategy, PassportModule, JwtModule],
})

export class AuthModule { }
