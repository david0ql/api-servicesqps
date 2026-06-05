import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';

import { PageOptionsDto } from 'src/dto/page-options.dto';
import { CreateTypeDto } from './dto/create-type.dto';
import { UpdateTypeDto } from './dto/update-type.dto';
import { PageDto } from 'src/dto/page.dto';

import { TypesService } from './types.service';

import { TypesEntity } from 'src/entities/types.entity';
import { SearchDto } from 'src/dto/search.dto';

@ApiBearerAuth()
@ApiTags('types')
@Controller('types')
export class TypesController {
  constructor(private readonly typesService: TypesService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createTypeDto: CreateTypeDto) {
    return this.typesService.create(createTypeDto);
  }

  @Post('/search')
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: PageOptionsDto, @Body() searchDto: SearchDto) {
    return this.typesService.searchByWord(searchDto, pageOptionsDto);
  }

  @Get()
  @ApiPaginatedResponse(TypesEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: PageOptionsDto): Promise<PageDto<TypesEntity>> {
    return this.typesService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.typesService.findOne(id);
  }

  @Get('/by-community/:id')
  @UseGuards(AuthGuard('jwt'))
  findByCommunities(@Param('id') id: string) {
    return this.typesService.findByCommunities(id);
  }

  @Get('/by-community/:id/all')
  @UseGuards(AuthGuard('jwt'))
  findAllByCommunities(@Param('id') id: string) {
    return this.typesService.findAllByCommunities(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateTypeDto: UpdateTypeDto) {
    return this.typesService.update(id, updateTypeDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.typesService.remove(id);
  }
}
