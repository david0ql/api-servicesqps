import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CLEANER_ZONE_ENFORCE_FROM, CleanerZonesService } from './cleaner-zones.service';
import { RolesEntity } from '../../entities/roles.entity';
import { UsersEntity } from '../../entities/users.entity';
import { CommunitiesEntity } from '../../entities/communities.entity';
import envVars from '../../config/env';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    CleanerZonesService,
    { provide: CLEANER_ZONE_ENFORCE_FROM, useFactory: () => envVars.CLEANER_ZONE_ENFORCE_FROM },
  ],
  exports: [CleanerZonesService],
  imports: [TypeOrmModule.forFeature([RolesEntity, UsersEntity, CommunitiesEntity])]
})

export class UsersModule { }
