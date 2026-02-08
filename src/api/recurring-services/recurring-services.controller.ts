import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { RecurringServicesService } from './recurring-services.service';
import { CreateRecurringServiceDto } from './dto/create-recurring-service.dto';
import { UpdateRecurringServiceDto } from './dto/update-recurring-service.dto';
import { PageOptionsDto } from 'src/dto/page-options.dto';
import { SearchDto } from 'src/dto/search.dto';

@ApiBearerAuth()
@ApiTags('recurring-services')
@Controller('recurring-services')
export class RecurringServicesController {
  constructor(private readonly recurringServicesService: RecurringServicesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createRecurringServiceDto: CreateRecurringServiceDto) {
    return this.recurringServicesService.create(createRecurringServiceDto);
  }

  @Post('/search')
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: PageOptionsDto, @Body() searchDto: SearchDto) {
    return this.recurringServicesService.searchByWord(searchDto, pageOptionsDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: PageOptionsDto) {
    return this.recurringServicesService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.recurringServicesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateRecurringServiceDto: UpdateRecurringServiceDto) {
    return this.recurringServicesService.update(id, updateRecurringServiceDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.recurringServicesService.remove(id);
  }
}
