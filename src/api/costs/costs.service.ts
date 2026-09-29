import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { PageOptionsDto } from 'src/dto/page-options.dto';
import { CreateCostDto } from './dto/create-cost.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { PageMetaDto } from 'src/dto/page-meta.dto';
import { PageDto } from 'src/dto/page.dto';

import { CostsEntity } from 'src/entities/costs.entity';
import { SearchDto } from 'src/dto/search.dto';

@Injectable()
export class CostsService {
  constructor(
    @InjectRepository(CostsEntity)
    private costsRepository: Repository<CostsEntity>,
  ) { }

  async create(createCostDto: CreateCostDto) {
    const cost = this.costsRepository.create(createCostDto);

    await this.costsRepository.save(cost);

    return cost;
  }

  async searchByWord(searchDto: SearchDto, pageOptionsDto: PageOptionsDto): Promise<PageDto<CostsEntity>> {
    const searchedItemsByWord = this.costsRepository.createQueryBuilder('costs')
      .orderBy('costs.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .where('costs.date LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('costs.description LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('costs.amount LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('costs.category LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })

    const [items, totalCount] = await searchedItemsByWord.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<CostsEntity>> {
    const [items, totalCount] = await this.costsRepository.findAndCount({
      order: { createdAt: pageOptionsDto.order },
      skip: pageOptionsDto.skip,
      take: pageOptionsDto.take,
    });

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const cost = await this.costsRepository.findOne({
      where: { id },
    });

    if (!cost) {
      throw new NotFoundException(`Cost with ID ${id} not found`);
    }

    return cost;
  }

  async update(id: string, updateCostDto: UpdateCostDto) {
    const cost = await this.costsRepository.preload({
      id,
      ...updateCostDto,
    });

    if (!cost) {
      throw new NotFoundException(`Cost with ID ${id} not found`);
    }

    await this.costsRepository.save(cost);

    return cost;
  }

  async remove(id: string) {
    const cost = await this.costsRepository.findOne({
      where: { id },
    });

    if (!cost) {
      throw new NotFoundException(`Cost with ID ${id} not found`);
    }

    return this.costsRepository.remove(cost);
  }
}
