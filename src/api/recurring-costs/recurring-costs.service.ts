import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';

import { StatusPageOptionsDto } from '../../dto/status-page-options.dto';
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

  async searchByWord(searchDto: SearchDto, pageOptionsDto: StatusPageOptionsDto): Promise<PageDto<RecurringCostsEntity>> {
    const query = this.recurringCostsRepository.createQueryBuilder('recurring_costs')
      .orderBy('recurring_costs.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take)
      .where(new Brackets((qb) => {
        qb.where('recurring_costs.description LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
          .orWhere('recurring_costs.amount LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
          .orWhere('recurring_costs.category LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
          .orWhere('recurring_costs.start_date LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` })
          .orWhere('recurring_costs.end_date LIKE :searchWord', { searchWord: `%${searchDto.searchWord}%` });
      }));
    this.applyStatusFilter(query, pageOptionsDto);

    const [items, totalCount] = await query.getManyAndCount();
    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  async findAll(pageOptionsDto: StatusPageOptionsDto): Promise<PageDto<RecurringCostsEntity>> {
    const query = this.recurringCostsRepository.createQueryBuilder('recurring_costs')
      .orderBy('recurring_costs.createdAt', pageOptionsDto.order)
      .skip(pageOptionsDto.skip)
      .take(pageOptionsDto.take);
    this.applyStatusFilter(query, pageOptionsDto);

    const [items, totalCount] = await query.getManyAndCount();
    const pageMetaDto = new PageMetaDto({ totalCount, pageOptionsDto });

    return new PageDto(items, pageMetaDto);
  }

  /** Sin status se devuelven todos (comportamiento anterior). */
  private applyStatusFilter(qb: any, pageOptionsDto: StatusPageOptionsDto) {
    if (pageOptionsDto.status === 'active' || pageOptionsDto.status === 'inactive') {
      qb.andWhere('recurring_costs.isActive = :isActive', { isActive: pageOptionsDto.status === 'active' });
    }
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
