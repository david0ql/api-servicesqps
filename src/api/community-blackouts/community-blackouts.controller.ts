import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { CommunityBlackoutsService } from './community-blackouts.service';
import { CreateCommunityBlackoutDto } from './dto/create-community-blackout.dto';
import { FindCommunityBlackoutsDto } from './dto/find-community-blackouts.dto';

@ApiBearerAuth()
@ApiTags('community-blackouts')
@Controller('community-blackouts')
export class CommunityBlackoutsController {
  constructor(private readonly blackoutsService: CommunityBlackoutsService) { }

  /** Lista bloqueos. Filtros opcionales: communityId y rango de fechas (solapamiento). */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  find(@Query() filter: FindCommunityBlackoutsDto) {
    return this.blackoutsService.find(filter);
  }

  /** Crea el bloqueo para una, varias (communityIds) o todas (allCommunities) las comunidades. */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateCommunityBlackoutDto, @Request() req: any) {
    return this.blackoutsService.create(dto, req.user?.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.blackoutsService.remove(id);
  }
}
