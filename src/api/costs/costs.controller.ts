import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';

import { PageOptionsDto } from 'src/dto/page-options.dto';
import { CreateCostDto } from './dto/create-cost.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { PageDto } from 'src/dto/page.dto';

import { CostsService } from './costs.service';

import { CostsEntity } from 'src/entities/costs.entity';
import { SearchDto } from 'src/dto/search.dto';
import { SkipApproval } from '../../decorators/skip-approval.decorator';

@ApiBearerAuth()
@ApiTags('costs')
@Controller('costs')
export class CostsController {
  constructor(private readonly costsService: CostsService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createCostDto: CreateCostDto) {
    return this.costsService.create(createCostDto);
  }

  // Lectura: no modifica datos.
  @Post('/search')
  @SkipApproval()
  @ApiPaginatedResponse(CostsEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: PageOptionsDto, @Body() searchDto: SearchDto): Promise<PageDto<CostsEntity>> {
    return this.costsService.searchByWord(searchDto, pageOptionsDto);
  }

  @Get()
  @ApiPaginatedResponse(CostsEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: PageOptionsDto): Promise<PageDto<CostsEntity>> {
    return this.costsService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.costsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateCostDto: UpdateCostDto) {
    return this.costsService.update(id, updateCostDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.costsService.remove(id);
  }
}
