import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Brackets, Repository } from 'typeorm';
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
}
