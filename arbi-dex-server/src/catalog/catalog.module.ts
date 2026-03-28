import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Source } from './entities/source.entity';
import { TradingPair } from './entities/trading-pair.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Source, TradingPair])],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}

