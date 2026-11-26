import { ApiBearerAuth, ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Post, Body, HttpCode, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';

import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthService } from './auth.service';
import { UserDto } from './dto/user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GetUser } from './decorators/get-user.decorator';
import { UsersEntity } from '../../entities/users.entity';
import { SkipApproval } from '../../decorators/skip-approval.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) { }

  // Login: sin usuario aún.
  @Post()
  @SkipApproval()
  @HttpCode(200)
  @ApiOkResponse({ description: 'Auth success' })
  @ApiBadRequestResponse({ description: 'Bad request - Validation errors' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async findAll(@Body() userDto: UserDto) {
    const user = await this.authService.login(userDto);

    const { message: { id, email, name, mustChangePassword } } = user

    return {
      token: this.generateToken({ id, email }),
      id,
      email,
      name,
      mustChangePassword: !!mustChangePassword,
    };

  }

  // Lectura liviana del usuario de la sesión. Está en la allowlist del cambio
  // de clave obligatorio: la app la usa para saber si debe mostrar el gate.
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  me(@GetUser() user: UsersEntity) {
    return this.authService.me(user);
  }

  // Cambio de clave del propio usuario. SkipApproval: es su propia credencial,
  // no un cambio de datos que deba aprobar un super admin.
  @Post('change-password')
  @SkipApproval()
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  changePassword(@GetUser() user: UsersEntity, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  private generateToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }
}
