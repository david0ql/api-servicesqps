import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseIntPipe, ParseDatePipe, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { UpdateServiceDto } from './dto/update-service.dto';

import { ServicesDashboard, ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServicesByManagerDto } from './dto/services-by-manager.dto';
import { PageOptionsDto } from '../../dto/page-options.dto';
import { SearchDto } from '../../dto/search.dto';
import { ServicesEntity } from '../../entities/services.entity';
import { ApiPaginatedResponse } from '../../decorators/api-paginated-response.decorator';
import { PageDto } from '../../dto/page.dto';

@ApiBearerAuth()
@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) { }

  @Post('/search')
  @ApiPaginatedResponse(ServicesEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: PageOptionsDto, @Body() searchDto: SearchDto): Promise<PageDto<ServicesEntity>> {
    return this.servicesService.searchByWord(searchDto, pageOptionsDto);
  }

  @Post('/search/by-communities')
  @ApiPaginatedResponse(ServicesEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWordByCommunities(
    @Query() pageOptionsDto: PageOptionsDto,
    @Body() searchDto: SearchDto,
    @Request() req: any,
  ): Promise<PageDto<ServicesEntity>> {
    return this.servicesService.searchByWordByCommunities(searchDto, req.user.user.id, pageOptionsDto);
  }

  @Get('')
  @ApiPaginatedResponse(ServicesEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: PageOptionsDto): Promise<PageDto<ServicesDashboard>> {
    return this.servicesService.findAll(pageOptionsDto);
  }

  @Get('/by-status/:statusID')
  @ApiPaginatedResponse(ServicesEntity)
  @UseGuards(AuthGuard('jwt'))
  findAllByStatusID(
    @Param('statusID') statusID: string,
    @Query() pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<ServicesEntity>> {
    return this.servicesService.findAllByStatusID(statusID, pageOptionsDto);
  }

  @Get('/by-user/:userID/:statusID')
  @ApiPaginatedResponse(ServicesEntity)
  @UseGuards(AuthGuard('jwt'))
  findAllByUserIDStatusID(
    @Param('userID') userID: string,
    @Param('statusID') statusID: string,
    @Query() pageOptionsDto: PageOptionsDto
  ): Promise<PageDto<ServicesEntity>> {
    return this.servicesService.findAllByUserIDStatusID(userID, statusID, pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post('/by-cleaner/:userId')
  @UseGuards(AuthGuard('jwt'))
  findByCleaner(
    @Param('userId') userId: string,
    @Query() pageOptionsDto: PageOptionsDto,
  ) {
    return this.servicesService.findByCleaner(userId, pageOptionsDto);
  }

  @Post('/by-cleaner-and-date/:userId/:date')
  @UseGuards(AuthGuard('jwt'))
  findByCleanerAndDate(
    @Param('userId') userId: string,
    @Param('date', new ParseDatePipe()) date: string,
  ) {
    return this.servicesService.findByCleanerAndDate(userId, date);
  }

  @Post('/by-communities')
  @ApiPaginatedResponse(ServicesEntity)
  @UseGuards(AuthGuard('jwt'))
  findByCommunities(
    @Query() pageOptionsDto: PageOptionsDto,
    @Body() servicesByManagerDto: ServicesByManagerDto,
  ): Promise<PageDto<ServicesEntity>> {
    return this.servicesService.findByCommunities(servicesByManagerDto, pageOptionsDto);
  }

  @Post('/by-status/:statusID')
  @ApiPaginatedResponse(ServicesEntity)
  @UseGuards(AuthGuard('jwt'))
  findByStatus(
    @Param('statusID') statusID: string,
    @Query() pageOptionsDto: PageOptionsDto,
    @Body() servicesByManagerDto: ServicesByManagerDto,
  ): Promise<PageDto<ServicesEntity>> {
    return this.servicesService.findByStatus(servicesByManagerDto, statusID, pageOptionsDto);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
