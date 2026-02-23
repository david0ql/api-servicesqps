import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PageOptionsDto } from 'src/dto/page-options.dto';
import { PageMetaDto } from 'src/dto/page-meta.dto';
import { PageDto } from 'src/dto/page.dto';
import { SearchDto } from 'src/dto/search.dto';

import { RecurringCostsEntity } from 'src/entities/recurring_costs.entity';
import { CreateRecurringCostDto } from './dto/create-recurring-cost.dto';
import { UpdateRecurringCostDto } from './dto/update-recurring-cost.dto';

@Injectable()
export class RecurringCostsService {
  constructor(
    @InjectRepository(RecurringCostsEntity)
    private recurringCostsRepository: Repository<RecurringCostsEntity>,
  ) {}

  async create(createRecurringCostDto: CreateRecurringCostDto) {
    const recurringCost = this.recurringCostsRepository.create({
      ...createRecurringCostDto,
      isActive: createRecurringCostDto.isActive ?? true,
    });

    await this.recurringCostsRepository.save(recurringCost);

    return recurringCost;
  }

  async searchByWord(searchDto: SearchDto, pageOptionsDto: PageOptionsDto): Promise<PageDto<RecurringCostsEntity>> {
    const query = this.recurringCostsRepository.createQueryBuilder('recurring_costs')
      .orderBy('recurring_costs.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .where('recurring_costs.description LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('recurring_costs.amount LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('recurring_costs.start_date LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
      .orWhere('recurring_costs.end_date LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` });

    const [items, totalCount] = await query.getManyAndCount();
    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: PageOptionsDto): Promise<PageDto<RecurringCostsEntity>> {
    const [items, totalCount] = await this.recurringCostsRepository.findAndCount({
      order: { createdAt: pageOptionsDto.order },
      skip: pageOptionsDto.skip,
      take: pageOptionsDto.take,
    });

    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const recurringCost = await this.recurringCostsRepository.findOne({
      where: { id },
    });

    if (!recurringCost) {
      throw new NotFoundException(`Recurring cost with ID ${id} not found`);
    }

    return recurringCost;
  }

  async update(id: string, updateRecurringCostDto: UpdateRecurringCostDto) {
    const recurringCost = await this.recurringCostsRepository.preload({
      id,
      ...updateRecurringCostDto,
    });

    if (!recurringCost) {
      throw new NotFoundException(`Recurring cost with ID ${id} not found`);
    }

    await this.recurringCostsRepository.save(recurringCost);

    return recurringCost;
  }

  async remove(id: string) {
    const recurringCost = await this.recurringCostsRepository.findOne({
      where: { id },
    });

    if (!recurringCost) {
      throw new NotFoundException(`Recurring cost with ID ${id} not found`);
    }

    return this.recurringCostsRepository.remove(recurringCost);
  }
}
