import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';

import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PageOptionsDto } from 'src/dto/page-options.dto';
import { PageDto } from 'src/dto/page.dto';

import { CompaniesService } from './companies.service';

import { CompaniesEntity } from 'src/entities/companies.entity';
import { SearchDto } from 'src/dto/search.dto';
import { SkipApproval } from '../../decorators/skip-approval.decorator';

@ApiBearerAuth()
@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  // Lectura: no modifica datos.
  @Post('/search')
  @SkipApproval()
  @ApiPaginatedResponse(CompaniesEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: PageOptionsDto, @Body() searchDto: SearchDto): Promise<PageDto<CompaniesEntity>> {
    return this.companiesService.searchByWord(searchDto, pageOptionsDto);
  }

  @Get()
  @ApiPaginatedResponse(CompaniesEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: PageOptionsDto): Promise<PageDto<CompaniesEntity>> {
    return this.companiesService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
