import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Source } from './entities/source.entity';
import { TradingPair } from './entities/trading-pair.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Source, TradingPair]),
    HttpModule.register({ timeout: 10000 }),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
