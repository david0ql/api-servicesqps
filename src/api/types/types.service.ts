import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { PageOptionsDto } from 'src/dto/page-options.dto';
import { CreateTypeDto } from './dto/create-type.dto';
import { UpdateTypeDto } from './dto/update-type.dto';
import { PageMetaDto } from 'src/dto/page-meta.dto';
import { PageDto } from 'src/dto/page.dto';

import { TypesEntity } from 'src/entities/types.entity';
import { SearchDto } from 'src/dto/search.dto';

@Injectable()
export class TypesService {
  constructor(
    @InjectRepository(TypesEntity)
    private typesRepository: Repository<TypesEntity>,
  ) { }

  async create(createTypeDto: CreateTypeDto) {
    const type = this.typesRepository.create(createTypeDto);

    await this.typesRepository.save(type);

    return type;
  }

  async searchByWord(searchDto: SearchDto, pageOptionsDto: PageOptionsDto): Promise<PageDto<TypesEntity>> {
    const searchedItemsByWord = this.typesRepository.createQueryBuilder('types')
      .innerJoinAndSelect('types.community', 'community')
      .orderBy('types.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .select([
        'types.id',
        'types.description',
        'types.cleaningType',
        'types.price',
        'types.commission',
        'types.showInMobile',
        'types.communityId',
        'types.createdAt',
        'types.updatedAt',
        'community.id',
        'community.communityName',
      ])
      .where('types.description LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('types.cleaningType LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('types.price LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('types.commission LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('community.communityName LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` });

    const [items, totalCount] = await searchedItemsByWord.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<TypesEntity>> {
    const queryBuilder = this.typesRepository.createQueryBuilder('types')
      .innerJoinAndSelect('types.community', 'community')
      .orderBy('types.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .select([
        'types.id',
        'types.description',
        'types.cleaningType',
        'types.price',
        'types.commission',
        'types.showInMobile',
        'types.communityId',
        'types.createdAt',
        'types.updatedAt',
        'community.id',
        'community.communityName',
      ]);

    const [items, totalCount] = await queryBuilder.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const type = await this.typesRepository.createQueryBuilder('types')
      .innerJoinAndSelect('types.community', 'community')
      .where('types.id = :id', { id })
      .select([
        'types.id',
        'types.description',
        'types.cleaningType',
        'types.price',
        'types.commission',
        'types.showInMobile',
        'types.communityId',
        'types.createdAt',
        'types.updatedAt',
        'community.id',
        'community.communityName',
      ])
      .getOne();

    if (!type) {
      throw new NotFoundException(`Type with ID ${id} not found`);
    }

    return type;
  }

  async findByCommunities(id: string) {
    const type = await this.typesRepository.createQueryBuilder('types')
      .innerJoinAndSelect('types.community', 'community')
      .where('types.communityId = :id', { id })
      .andWhere('types.showInMobile = :showInMobile', { showInMobile: true })
      .select([
        'types.id',
        'types.description',
        'types.cleaningType',
        'types.price',
        'types.commission',
        'types.showInMobile',
        'types.communityId',
        'types.createdAt',
        'types.updatedAt',
        'community.id',
        'community.communityName',
      ])
      .getMany();

    if (!type) {
      throw new NotFoundException(`Type with ID ${id} not found`);
    }

    return type;
  }

  async findAllByCommunities(id: string) {
    const type = await this.typesRepository.createQueryBuilder('types')
      .innerJoinAndSelect('types.community', 'community')
      .where('types.communityId = :id', { id })
      .select([
        'types.id',
        'types.description',
        'types.cleaningType',
        'types.price',
        'types.commission',
        'types.showInMobile',
        'types.communityId',
        'types.createdAt',
        'types.updatedAt',
        'community.id',
        'community.communityName',
      ])
      .getMany();

    if (!type) {
      throw new NotFoundException(`Type with ID ${id} not found`);
    }

    return type;
  }

  async update(id: string, updateTypeDto: UpdateTypeDto) {
    const type = await this.typesRepository.preload({
      id,
      ...updateTypeDto,
    });

    if (!type) {
      throw new NotFoundException(`Status with ID ${id} not found`);
    }

    await this.typesRepository.save(type);

    return type;
  }

  async remove(id: string) {
    const type = await this.typesRepository.findOne({
      where: { id },
    });

    if (!type) {
      throw new NotFoundException(`Status with ID ${id} not found`);
    }

    return this.typesRepository.remove(type);
  }
}
