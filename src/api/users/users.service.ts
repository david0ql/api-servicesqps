import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { PageOptionsDto } from 'src/dto/page-options.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PageMetaDto } from 'src/dto/page-meta.dto';
import { PageDto } from 'src/dto/page.dto';

import { RolesEntity } from 'src/entities/roles.entity';
import { UsersEntity } from 'src/entities/users.entity';
import { SearchDto } from 'src/dto/search.dto';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(RolesEntity)
    private readonly rolesRepository: Repository<RolesEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>
  ) { }

  async create(createUserDto: CreateUserDto) {
    createUserDto.password = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create(createUserDto);

    await this.usersRepository.save(user);

    return user;
  }

  async searchByWord(searchDto: SearchDto, pageOptionsDto: PageOptionsDto): Promise<PageDto<UsersEntity>> {
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
        'users.createdAt',
        'role.id',
        'role.name',
      ])
      .where('users.name LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('users.email LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('users.phoneNumber LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('role.name LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })

    const [items, totalCount] = await searchedItemsByWord.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<UsersEntity>> {
    const queryBuilder = this.usersRepository.createQueryBuilder('user');
    queryBuilder.innerJoinAndSelect('user.role', 'role');
    queryBuilder.orderBy('user.createdAt', pageOptionsDto.order);
    queryBuilder.skip(pageOptionsDto.skip);
    queryBuilder.take(pageOptionsDto.take);
    queryBuilder.select([
      'user.id',
      'user.name',
      'user.email',
      'user.phoneNumber',
      'user.roleId',
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
    return roles;
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
        'user.createdAt',
        'role.id',
        'role.name',
      ])
      .getOne();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
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

    return this.usersRepository.remove(user);
  }
}
