import { BadRequestException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { UserDto } from './dto/user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
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

  /** Estado liviano del usuario de la sesión (lo consulta la app al abrir). */
  me(user: UsersEntity) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { currentPassword, newPassword } = dto;

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');

    const currentOk = await bcrypt.compare(currentPassword, user.password);
    if (!currentOk) throw new BadRequestException('La clave actual no es correcta.');

    if (newPassword === currentPassword) {
      throw new BadRequestException('La clave nueva debe ser distinta a la actual.');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const passwordChangedAt = new Date();
    await this.usersRepository.update(user.id, {
      password: hashed,
      mustChangePassword: false,
      passwordChangedAt,
    });

    return { ok: true, mustChangePassword: false, passwordChangedAt };
  }
}
