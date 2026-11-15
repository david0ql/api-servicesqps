import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';


import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

import { CommunitiesService } from './communities.service';
import { PageOptionsDto } from '../../dto/page-options.dto';
import { CommunitiesEntity } from '../../entities/communities.entity';
import { SearchDto } from '../../dto/search.dto';
import { PageDto } from '../../dto/page.dto';
import { ApiPaginatedResponse } from '../../decorators/api-paginated-response.decorator';
import { SkipApproval } from '../../decorators/skip-approval.decorator';


@ApiBearerAuth()
@ApiTags('communities')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createCommunityDto: CreateCommunityDto) {
    return this.communitiesService.create(createCommunityDto);
  }

  // Lectura: no modifica datos.
  @Post('/search')
  @SkipApproval()
  @ApiPaginatedResponse(CommunitiesEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: PageOptionsDto, @Body() searchDto: SearchDto): Promise<PageDto<CommunitiesEntity>> {
    return this.communitiesService.searchByWord(searchDto, pageOptionsDto);
  }

  @Get()
  @ApiPaginatedResponse(CommunitiesEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: PageOptionsDto): Promise<PageDto<CommunitiesEntity>> {
    return this.communitiesService.findAll(pageOptionsDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.communitiesService.findOne(id);
  }

  @Get('/by-manager/:id')
  @UseGuards(AuthGuard('jwt'))
  findAllByManager(@Param('id') id: string) {
    return this.communitiesService.findAllByManager(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateCommunityDto: UpdateCommunityDto) {
    return this.communitiesService.update(id, updateCommunityDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.communitiesService.remove(id);
  }
}
