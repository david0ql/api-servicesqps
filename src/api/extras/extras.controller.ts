import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';

import { PageOptionsDto } from 'src/dto/page-options.dto';
import { CreateExtraDto } from './dto/create-extra.dto';
import { UpdateExtraDto } from './dto/update-extra.dto';
import { PageDto } from 'src/dto/page.dto';

import { ExtrasService } from './extras.service';

import { ExtrasEntity } from 'src/entities/extras.entity';
import { SearchDto } from 'src/dto/search.dto';
import { SkipApproval } from '../../decorators/skip-approval.decorator';

@ApiBearerAuth()
@ApiTags('extras')
@Controller('extras')
export class ExtrasController {
  constructor(private readonly extrasService: ExtrasService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createExtraDto: CreateExtraDto) {
    return this.extrasService.create(createExtraDto);
  }

  // Lectura: no modifica datos.
  @Post('/search')
  @SkipApproval()
  @ApiPaginatedResponse(ExtrasEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: PageOptionsDto, @Body() searchDto: SearchDto): Promise<PageDto<ExtrasEntity>> {
    return this.extrasService.searchByWord(searchDto, pageOptionsDto);
  }

  @Get()
  @ApiPaginatedResponse(ExtrasEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: PageOptionsDto): Promise<PageDto<ExtrasEntity>> {
    return this.extrasService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.extrasService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateExtraDto: UpdateExtraDto) {
    return this.extrasService.update(id, updateExtraDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.extrasService.remove(id);
  }
}
