import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';

import { UsersService } from './users.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PageDto } from 'src/dto/page.dto';

import { UsersEntity } from 'src/entities/users.entity';
import { UsersPageOptionsDto } from './dto/users-page-options.dto';
import { SearchDto } from 'src/dto/search.dto';
import { SkipApproval } from '../../decorators/skip-approval.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { PushTokenDto } from './dto/push-token.dto';

@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // Lectura: no modifica datos.
  @Post('/search')
  @SkipApproval()
  @ApiPaginatedResponse(UsersEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: UsersPageOptionsDto, @Body() searchDto: SearchDto): Promise<PageDto<UsersEntity>> {
    return this.usersService.searchByWord(searchDto, pageOptionsDto);
  }

  /**
   * Registra el push token del dispositivo para la cuenta activa y lo quita de
   * cualquier otro usuario. Solo afecta al propio usuario (sin aprobación).
   */
  @Post('me/push-token')
  @SkipApproval()
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  assignPushToken(@GetUser() user: UsersEntity, @Body() dto: PushTokenDto) {
    return this.usersService.assignPushToken(user.id, dto.token);
  }

  /** Cerrar sesión de una cuenta: deja de enviarle push a este dispositivo. */
  @Delete('me/push-token')
  @SkipApproval()
  @UseGuards(AuthGuard('jwt'))
  clearPushToken(@GetUser() user: UsersEntity, @Body() dto: PushTokenDto) {
    return this.usersService.clearPushToken(user.id, dto.token);
  }

  @Get()
  @ApiPaginatedResponse(UsersEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: UsersPageOptionsDto): Promise<PageDto<UsersEntity>> {
    return this.usersService.findAll(pageOptionsDto);
  }

  @Get("roles")
  @UseGuards(AuthGuard('jwt'))
  findAllRoles() {
    return this.usersService.findAllRoles();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
