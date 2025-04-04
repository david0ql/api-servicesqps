import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Repository } from 'typeorm';

import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { CommunitiesEntity } from '../../entities/communities.entity';
import { SearchDto } from '../../dto/search.dto';
import { PageOptionsDto } from '../../dto/page-options.dto';
import { PageDto } from '../../dto/page.dto';
import { PageMetaDto } from '../../dto/page-meta.dto';
import { PushNotificationsService } from '../../push-notification/push-notification.service';

@Injectable()
export class CommunitiesService {

  constructor(
    @InjectRepository(CommunitiesEntity)
    private readonly communitiesRepository: Repository<CommunitiesEntity>,
  ) { }

  async create(createCommunityDto: CreateCommunityDto) {
    const community = this.communitiesRepository.create(createCommunityDto);

    await this.communitiesRepository.save(community);

    return community;
  }

  async searchByWord(searchDto: SearchDto, pageOptionsDto: PageOptionsDto): Promise<PageDto<CommunitiesEntity>> {
    const searchedItemsByWord = this.communitiesRepository.createQueryBuilder('communities')
      .innerJoinAndSelect('communities.user', 'user')
      .innerJoinAndSelect('communities.company', 'company')
      .innerJoinAndSelect('user.role', 'role')
      .orderBy('communities.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .select([
        'communities.id',
        'communities.communityName',
        'communities.createdAt',
        'communities.updatedAt',
        'user.id',
        'user.name',
        'user.email',
        'user.phoneNumber',
        'company.id',
        'company.companyName',
        'role.id',
        'role.name',
      ])
      .where('communities.communityName like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('user.name like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('user.email like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('user.phoneNumber like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('company.companyName like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('role.name like :searchWord', { searchWord: `%${searchDto.searchWord}%` });

    const [items, totalCount] = await searchedItemsByWord.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<CommunitiesEntity>> {
    const queryBuilder = this.communitiesRepository.createQueryBuilder('communities')
      .innerJoinAndSelect('communities.user', 'user')
      .innerJoinAndSelect('communities.company', 'company')
      .innerJoinAndSelect('user.role', 'role')
      .orderBy('communities.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .select([
        'communities.id',
        'communities.communityName',
        'communities.createdAt',
        'communities.updatedAt',
        'user.id',
        'user.name',
        'user.email',
        'user.phoneNumber',
        'company.id',
        'company.companyName',
        'role.id',
        'role.name',
      ])

    const [items, totalCount] = await queryBuilder.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAllByManager(id: string) {
    const queryBuilder = this.communitiesRepository.createQueryBuilder('communities')
      .innerJoinAndSelect('communities.user', 'user')
      .innerJoinAndSelect('communities.company', 'company')
      .innerJoinAndSelect('user.role', 'role')
      .where('communities.userId = :id', { id })
      .select([
        'communities.id',
        'communities.communityName',
        'communities.createdAt',
        'communities.updatedAt',
        'user.id',
        'user.name',
        'user.email',
        'user.phoneNumber',
        'company.id',
        'company.companyName',
        'role.id',
        'role.name',
      ])

    const communities = await queryBuilder.getMany();

    if (!communities || communities.length === 0) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }

    return communities;
  }

  async findOne(id: string) {
    const community = await this.communitiesRepository.createQueryBuilder('communities')
      .innerJoinAndSelect('communities.user', 'user')
      .innerJoinAndSelect('communities.company', 'company')
      .innerJoinAndSelect('user.role', 'role')
      .where('communities.id = :id', { id })
      .select([
        'communities.id',
        'communities.communityName',
        'communities.createdAt',
        'communities.updatedAt',
        'user.id',
        'user.name',
        'user.email',
        'user.phoneNumber',
        'company.id',
        'company.companyName',
        'role.id',
        'role.name',
      ])
      .getOne();

    if (!community) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }

    return community;
  }

  async update(id: string, updateCommunityDto: UpdateCommunityDto) {
    const community = await this.communitiesRepository.preload({
      id,
      ...updateCommunityDto,
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }

    await this.communitiesRepository.save(updateCommunityDto);

    return community;
  }

  async remove(id: string) {
    const community = await this.communitiesRepository.findOne({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }

    return this.communitiesRepository.remove(community);
  }
}
