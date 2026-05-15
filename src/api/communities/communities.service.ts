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
      .leftJoinAndSelect('communities.supervisorUser', 'supervisorUser')
      .leftJoinAndSelect('communities.managerUser', 'managerUser')
      .leftJoinAndSelect('communities.company', 'company')
      .leftJoinAndSelect('supervisorUser.role', 'supervisorRole')
      .leftJoinAndSelect('managerUser.role', 'managerRole')
      .orderBy('communities.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .select([
        'communities.id',
        'communities.communityName',
        'communities.showInReports',
        'communities.createdAt',
        'communities.updatedAt',
        'supervisorUser.id',
        'supervisorUser.name',
        'supervisorUser.email',
        'supervisorUser.phoneNumber',
        'managerUser.id',
        'managerUser.name',
        'managerUser.email',
        'managerUser.phoneNumber',
        'company.id',
        'company.companyName',
        'supervisorRole.id',
        'supervisorRole.name',
        'managerRole.id',
        'managerRole.name',
      ])
      .where('communities.communityName like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('supervisorUser.name like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('supervisorUser.email like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('supervisorUser.phoneNumber like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('managerUser.name like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('managerUser.email like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('managerUser.phoneNumber like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('company.companyName like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('supervisorRole.name like :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('managerRole.name like :searchWord', { searchWord: `%${searchDto.searchWord}%` });

    const [items, totalCount] = await searchedItemsByWord.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<CommunitiesEntity>> {
    const queryBuilder = this.communitiesRepository.createQueryBuilder('communities')
      .leftJoinAndSelect('communities.supervisorUser', 'supervisorUser')
      .leftJoinAndSelect('communities.managerUser', 'managerUser')
      .leftJoinAndSelect('communities.company', 'company')
      .leftJoinAndSelect('supervisorUser.role', 'supervisorRole')
      .leftJoinAndSelect('managerUser.role', 'managerRole')
      .orderBy('communities.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .select([
        'communities.id',
        'communities.communityName',
        'communities.showInReports',
        'communities.createdAt',
        'communities.updatedAt',
        'supervisorUser.id',
        'supervisorUser.name',
        'supervisorUser.email',
        'supervisorUser.phoneNumber',
        'managerUser.id',
        'managerUser.name',
        'managerUser.email',
        'managerUser.phoneNumber',
        'company.id',
        'company.companyName',
        'supervisorRole.id',
        'supervisorRole.name',
        'managerRole.id',
        'managerRole.name',
      ]);

    const [items, totalCount] = await queryBuilder.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAllByManager(id: string) {
    const queryBuilder = this.communitiesRepository.createQueryBuilder('communities')
      .leftJoinAndSelect('communities.supervisorUser', 'supervisorUser')
      .leftJoinAndSelect('communities.managerUser', 'managerUser')
      .leftJoinAndSelect('communities.company', 'company')
      .leftJoinAndSelect('supervisorUser.role', 'supervisorRole')
      .leftJoinAndSelect('managerUser.role', 'managerRole')
      .where('communities.supervisorUserId = :id OR communities.managerUserId = :id', { id })
      .select([
        'communities.id',
        'communities.communityName',
        'communities.showInReports',
        'communities.createdAt',
        'communities.updatedAt',
        'supervisorUser.id',
        'supervisorUser.name',
        'supervisorUser.email',
        'supervisorUser.phoneNumber',
        'managerUser.id',
        'managerUser.name',
        'managerUser.email',
        'managerUser.phoneNumber',
        'company.id',
        'company.companyName',
        'supervisorRole.id',
        'supervisorRole.name',
        'managerRole.id',
        'managerRole.name',
      ]);

    const communities = await queryBuilder.getMany();

    if (!communities || communities.length === 0) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }

    return communities;
  }

  async findOne(id: string) {
    const community = await this.communitiesRepository.createQueryBuilder('communities')
      .leftJoinAndSelect('communities.supervisorUser', 'supervisorUser')
      .leftJoinAndSelect('communities.managerUser', 'managerUser')
      .leftJoinAndSelect('communities.company', 'company')
      .leftJoinAndSelect('supervisorUser.role', 'supervisorRole')
      .leftJoinAndSelect('managerUser.role', 'managerRole')
      .where('communities.id = :id', { id })
      .select([
        'communities.id',
        'communities.communityName',
        'communities.showInReports',
        'communities.createdAt',
        'communities.updatedAt',
        'supervisorUser.id',
        'supervisorUser.name',
        'supervisorUser.email',
        'supervisorUser.phoneNumber',
        'managerUser.id',
        'managerUser.name',
        'managerUser.email',
        'managerUser.phoneNumber',
        'company.id',
        'company.companyName',
        'supervisorRole.id',
        'supervisorRole.name',
        'managerRole.id',
        'managerRole.name',
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
