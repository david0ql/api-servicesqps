import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommunityBlackoutsController } from './community-blackouts.controller';
import { CommunityBlackoutsService } from './community-blackouts.service';
import { CommunityBlackoutsEntity } from '../../entities/community_blackouts.entity';
import { CommunitiesEntity } from '../../entities/communities.entity';
import { ServicesEntity } from '../../entities/services.entity';

@Module({
  controllers: [CommunityBlackoutsController],
  providers: [CommunityBlackoutsService],
  exports: [CommunityBlackoutsService],
  imports: [TypeOrmModule.forFeature([CommunityBlackoutsEntity, CommunitiesEntity, ServicesEntity])],
})
export class CommunityBlackoutsModule { }
