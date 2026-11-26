import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
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
import { RequirePasswordChangeByRoleDto } from './dto/require-password-change.dto';

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

  /**
   * Pide cambio de clave a TODOS los usuarios activos de un rol (solo admin).
   * Para obligar a todos los cleaners activos: body { "roleId": "4" }
   * (en la web: Users > "Pedir cambio de clave a todo un rol").
   */
  @Post('require-password-change')
  @UseGuards(AuthGuard('jwt'))
  requirePasswordChangeForRole(@Body() dto: RequirePasswordChangeByRoleDto, @GetUser() actor: UsersEntity) {
    return this.usersService.requirePasswordChangeForRole(dto.roleId, actor);
  }

  @Post(':id/require-password-change')
  @UseGuards(AuthGuard('jwt'))
  requirePasswordChange(@Param('id') id: string, @GetUser() actor: UsersEntity) {
    return this.usersService.requirePasswordChange(id, actor);
  }

  @Delete(':id/require-password-change')
  @UseGuards(AuthGuard('jwt'))
  cancelPasswordChange(@Param('id') id: string, @GetUser() actor: UsersEntity) {
    return this.usersService.cancelPasswordChange(id, actor);
  }

  // Lectura: no modifica datos.
  @Post('/search')
  @SkipApproval()
  @ApiPaginatedResponse(UsersEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: UsersPageOptionsDto, @Body() searchDto: SearchDto): Promise<PageDto<UsersEntity>> {
    return this.usersService.searchByWord(searchDto, pageOptionsDto);
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
