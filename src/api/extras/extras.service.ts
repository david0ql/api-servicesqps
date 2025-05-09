import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { CreateExtraDto } from './dto/create-extra.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';
import { ExtrasEntity } from '../../entities/extras.entity';
import { SearchDto } from '../../dto/search.dto';
import { PageOptionsDto } from '../../dto/page-options.dto';
import { PageDto } from '../../dto/page.dto';
import { PageMetaDto } from '../../dto/page-meta.dto';

@Injectable()
export class ExtrasService {
  constructor(
    @InjectRepository(ExtrasEntity)
    private extrasRepository: Repository<ExtrasEntity>,
  ) { }

  async create(createExtraDto: CreateExtraDto) {
    const extra = this.extrasRepository.create(createExtraDto);

    await this.extrasRepository.save(extra);

    return extra;
  }

  async searchByWord(searchDto: SearchDto, pageOptionsDto: PageOptionsDto): Promise<PageDto<ExtrasEntity>> {
    const searchedItemsByWord = this.extrasRepository.createQueryBuilder('extras')
      .orderBy('extras.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .where('extras.item LIKE :searchWord', {
        searchWord: `%${searchDto.searchWord}%`,
      })
      .orWhere('extras.itemPrice LIKE :searchWord', {
        searchWord: `%${searchDto.searchWord}%`,
      })
      .orWhere('extras.commission LIKE :searchWord', {
        searchWord: `%${searchDto.searchWord}%`,
      })

    const [items, totalCount] = await searchedItemsByWord.getManyAndCount();

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<ExtrasEntity>> {
    const [items, totalCount] = await this.extrasRepository.findAndCount({
      order: { createdAt: pageOptionsDto.order },
      skip: pageOptionsDto.skip,
      take: pageOptionsDto.take,
    });

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const extra = await this.extrasRepository.findOne({
      where: { id },
    });

    if (!extra) {
      throw new NotFoundException(`Extra with ID ${id} not found`);
    }

    return extra;
  }

  async update(id: string, updateExtraDto: UpdateExtraDto) {
    const extra = await this.extrasRepository.preload({
      id,
      ...updateExtraDto,
    });

    if (!extra) {
      throw new NotFoundException(`Extra with ID ${id} not found`);
    }

    await this.extrasRepository.save(extra);

    return extra;
  }

  async remove(id: string) {
    const extra = await this.extrasRepository.findOne({
      where: { id },
    });

    if (!extra) {
      throw new NotFoundException(`Extra with ID ${id} not found`);
    }

    return this.extrasRepository.remove(extra);
  }
}
