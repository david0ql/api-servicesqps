import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { ApiPaginatedResponse } from 'src/decorators/api-paginated-response.decorator';

import { UsersService } from './users.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PageDto } from 'src/dto/page.dto';

import { UsersEntity } from 'src/entities/users.entity';
import { UsersPageOptionsDto } from './dto/users-page-options.dto';
import { SearchDto } from 'src/dto/search.dto';
import { SkipApproval } from '../../decorators/skip-approval.decorator';
import { CleanerZonesService } from './cleaner-zones.service';
import { EligibleByCommunitiesQueryDto, EligibleCleanersQueryDto, UpdateWorkZoneDto } from './dto/update-work-zone.dto';

@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cleanerZonesService: CleanerZonesService,
  ) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // Lectura: no modifica datos.
  @Post('/search')
  @SkipApproval()
  @ApiPaginatedResponse(UsersEntity)
  @UseGuards(AuthGuard('jwt'))
  searchByWord(@Query() pageOptionsDto: UsersPageOptionsDto, @Body() searchDto: SearchDto): Promise<PageDto<UsersEntity>> {
    return this.usersService.searchByWord(searchDto, pageOptionsDto);
  }

  @Get()
  @ApiPaginatedResponse(UsersEntity)
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query() pageOptionsDto: UsersPageOptionsDto): Promise<PageDto<UsersEntity>> {
    return this.usersService.findAll(pageOptionsDto);
  }

  @Get("roles")
  @UseGuards(AuthGuard('jwt'))
  findAllRoles() {
    return this.usersService.findAllRoles();
  }

  /** Periodo de gracia de la zona de trabajo: { enforced, enforceFrom }. */
  @Get('cleaner-zones/status')
  @UseGuards(AuthGuard('jwt'))
  cleanerZoneStatus() {
    return this.cleanerZonesService.getStatus();
  }

  /**
   * Cleaners/QA asignables a la comunidad. Con la zona en vigor solo vienen las
   * cleaners elegibles (QA siempre); en el periodo de gracia vienen todas.
   */
  @Get('eligible-cleaners')
  @UseGuards(AuthGuard('jwt'))
  eligibleCleaners(@Query() query: EligibleCleanersQueryDto) {
    return this.cleanerZonesService.findEligibleAssignees(query.communityId);
  }

  /** Lote para el balanceador del calendario: { eligibleByCommunity: { [communityId]: userId[] } }. */
  @Get('eligible-cleaners/by-community')
  @UseGuards(AuthGuard('jwt'))
  eligibleCleanersByCommunity(@Query() query: EligibleByCommunitiesQueryDto) {
    return this.cleanerZonesService.findEligibleByCommunities(query.communityIds);
  }

  @Get(':id/work-zone')
  @UseGuards(AuthGuard('jwt'))
  getWorkZone(@Param('id') id: string) {
    return this.cleanerZonesService.getWorkZone(id);
  }

  @Patch(':id/work-zone')
  @UseGuards(AuthGuard('jwt'))
  updateWorkZone(@Param('id') id: string, @Body() dto: UpdateWorkZoneDto) {
    return this.cleanerZonesService.updateWorkZone(id, dto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
