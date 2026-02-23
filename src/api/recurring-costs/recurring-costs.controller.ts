import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';
import { PageOptionsDto } from 'src/dto/page-options.dto';
import { PageDto } from 'src/dto/page.dto';
import { SearchDto } from 'src/dto/search.dto';

import { RecurringCostsEntity } from 'src/entities/recurring_costs.entity';
import { RecurringCostsService } from './recurring-costs.service';
import { CreateRecurringCostDto } from './dto/create-recurring-cost.dto';
import { UpdateRecurringCostDto } from './dto/update-recurring-cost.dto';

@ApiBearerAuth()
@ApiTags('recurring-costs')
@Controller('recurring-costs')
export class RecurringCostsController {
  constructor(private readonly recurringCostsService: RecurringCostsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createRecurringCostDto: CreateRecurringCostDto) {
    return this.recurringCostsService.create(createRecurringCostDto);
  }

  @Post('/search')
  @ApiPaginatedResponse(RecurringCostsEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(
    @Query() pageOptionsDto: PageOptionsDto,
    @Body() searchDto: SearchDto,
  ): Promise<PageDto<RecurringCostsEntity>> {
    return this.recurringCostsService.searchByWord(searchDto, pageOptionsDto);
  }

  @Get()
  @ApiPaginatedResponse(RecurringCostsEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: PageOptionsDto): Promise<PageDto<RecurringCostsEntity>> {
    return this.recurringCostsService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.recurringCostsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateRecurringCostDto: UpdateRecurringCostDto) {
    return this.recurringCostsService.update(id, updateRecurringCostDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.recurringCostsService.remove(id);
  }
}
