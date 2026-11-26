import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Brackets, Not, Repository } from 'typeorm';
import { Expo } from 'expo-server-sdk';
import * as bcrypt from 'bcryptjs';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesEntity } from '../../entities/roles.entity';
import { UsersEntity } from '../../entities/users.entity';
import { SearchDto } from '../../dto/search.dto';
import { UsersPageOptionsDto } from './dto/users-page-options.dto';
import { PageDto } from '../../dto/page.dto';
import { PageMetaDto } from '../../dto/page-meta.dto';

/** Roles que ya no se usan. 5 = Cheo (retirado el 2026-11-22). */
export const RETIRED_ROLE_IDS = new Set(['5']);

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(RolesEntity)
    private readonly rolesRepository: Repository<RolesEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
  ) { }

  async create(createUserDto: CreateUserDto) {
    createUserDto.password = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create(createUserDto);

    await this.usersRepository.save(user);

    return user;
  }

  /**
   * Busqueda libre combinable con el filtro de rol de la pestana Users.
   * Los LIKE van entre parentesis (Brackets): sin ellos `A OR B OR C AND rol`
   * se evalua como `A OR B OR (C AND rol)` y el filtro de rol no se aplicaria.
   */
  async searchByWord(searchDto: SearchDto, pageOptionsDto: UsersPageOptionsDto): Promise<PageDto<UsersEntity>> {
    const searchWord = `%${searchDto.searchWord}%`;
    const searchedItemsByWord = this.usersRepository.createQueryBuilder('users')
      .innerJoinAndSelect('users.role', 'role')
      .orderBy('users.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .select([
        'users.id',
        'users.name',
        'users.email',
        'users.phoneNumber',
        'users.roleId',
        'users.isActive',
        'users.createdAt',
        'role.id',
        'role.name',
      ])
      .where(new Brackets((qb) => {
        qb.where('users.name LIKE :searchWord', { searchWord })
          .orWhere('users.email LIKE :searchWord', { searchWord })
          .orWhere('users.phoneNumber LIKE :searchWord', { searchWord })
          .orWhere('role.name LIKE :searchWord', { searchWord });
      }));

    if (pageOptionsDto.roleId) {
      searchedItemsByWord.andWhere('users.roleId = :roleId', { roleId: pageOptionsDto.roleId });
    }
    if (pageOptionsDto.status === 'active' || pageOptionsDto.status === 'inactive') {
      searchedItemsByWord.andWhere('users.isActive = :isActive', { isActive: pageOptionsDto.status === 'active' });
    }

    const [items, totalCount] = await searchedItemsByWord.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: UsersPageOptionsDto): Promise<PageDto<UsersEntity>> {
    const queryBuilder = this.usersRepository.createQueryBuilder('user');
    queryBuilder.innerJoinAndSelect('user.role', 'role');
    if (pageOptionsDto.activeOnly || pageOptionsDto.status === 'active') {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: true });
    } else if (pageOptionsDto.status === 'inactive') {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: false });
    }
    if (pageOptionsDto.roleId) {
      queryBuilder.andWhere('user.roleId = :roleId', { roleId: pageOptionsDto.roleId });
    }
    queryBuilder.orderBy('user.createdAt', pageOptionsDto.order);
    queryBuilder.skip(pageOptionsDto.skip);
    queryBuilder.take(pageOptionsDto.take);
    queryBuilder.select([
      'user.id',
      'user.name',
      'user.email',
      'user.phoneNumber',
      'user.roleId',
      'user.isActive',
      'user.createdAt',
      'role.id',
      'role.name',
    ]);

    const [items, totalCount] = await queryBuilder.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAllRoles() {
    const roles = await this.rolesRepository.find();
    // Roles retirados: siguen en la tabla (usuarios inactivos los referencian),
    // pero ya no se ofrecen para asignar ni filtrar.
    return roles.filter((role) => !RETIRED_ROLE_IDS.has(String(role.id)));
  }

  async findOne(id: string) {
    const user = await this.usersRepository.createQueryBuilder('user')
      .innerJoinAndSelect('user.role', 'role')
      .where('user.id = :id', { id })
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.phoneNumber',
        'user.roleId',
        'user.isActive',
        'user.createdAt',
        'role.id',
        'role.name',
      ])
      .getOne();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    console.log('Current role.id:', user.role.id, 'Type:', typeof user.role.id);
    
    // Convert to string for comparison and handle both string and number types
    const roleIdStr = String(user.role.id);
    if (roleIdStr === '6') {
      console.log('Converting role.id and user.roleId from 6 to 3');
      user.role.id = '3';
      user.roleId = '3';
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findOne({ where: { id } });
  
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
  
    Object.assign(user, updateUserDto);
  
    await this.usersRepository.save(user);

    delete user.password;

    return user;
  }

  async remove(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Los usuarios conservan relaciones con servicios, comunidades, reportes y
    // mensajes. Borrarlos fisicamente puede romper ese historial; DELETE queda
    // como operacion compatible, pero ahora solo los inactiva.
    user.isActive = false;
    return this.usersRepository.save(user);
  }

  /**
   * Asigna el push token del dispositivo al usuario autenticado (cuenta ACTIVA en
   * la app) y se lo quita a cualquier otro usuario que lo tuviera: un dispositivo
   * notifica a una sola cuenta a la vez. Con varias cuentas en el mismo teléfono
   * la app llama a este endpoint al iniciar y al cambiar de cuenta, así que las
   * cuentas inactivas del dispositivo dejan de recibir push hasta volver a activarse.
   * El login (/auth) sigue guardando el token sin limpiar a nadie (compatibilidad
   * con versiones viejas de la app).
   */
  async assignPushToken(userId: string, rawToken: string) {
    const token = rawToken?.trim();
    if (!token || !Expo.isExpoPushToken(token)) {
      throw new BadRequestException('Invalid Expo push token');
    }

    await this.usersRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(UsersEntity);
      // users.token no admite NULL (default ''), por eso se limpia con ''.
      await repo.update({ token, id: Not(userId) }, { token: '' });
      await repo.update({ id: userId }, { token });
    });

    return { ok: true };
  }

  /** Quita el push token del usuario si coincide con el del dispositivo (cerrar sesión). */
  async clearPushToken(userId: string, rawToken?: string) {
    const token = rawToken?.trim();
    if (!token) return { ok: true };
    await this.usersRepository.update({ id: userId, token }, { token: '' });
    return { ok: true };
  }
}
