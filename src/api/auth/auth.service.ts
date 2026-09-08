import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { UserDto } from './dto/user.dto';
import { UsersEntity } from '../../entities/users.entity';
import { PushNotificationsService } from '../../push-notification/push-notification.service';

@Injectable()
export class AuthService {

  constructor(
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    private readonly pushNotificationService: PushNotificationsService,
  ) { }

  async login(userDto: UserDto) {
    const { username, password, token } = userDto;

    const user = await this.usersRepository.findOne({
      where: { email: username },
    });

    if (!user || !user.isActive) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new NotFoundException('User not found');

    delete user.password;

    console.log(token)

    if (token) {
      await this.usersRepository.update(user.id, { token });

      this.pushNotificationService.sendNotification({
        body: 'Welcome to our app',
        title: 'Login successful',
        data: { userId: user.id },
        sound: 'default',
        tokensNotification: {
          tokens: [token],
          users: [user],
        },
      })
    }

    return {
      status: HttpStatus.OK,
      message: user,
      error: 'Ok',
    };
  }
}
