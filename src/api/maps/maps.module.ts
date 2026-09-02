import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { CommunitiesEntity } from '../../entities/communities.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommunitiesEntity])],
  controllers: [MapsController],
  providers: [MapsService],
})
export class MapsModule {}
