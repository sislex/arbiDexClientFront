import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketConfigsController } from './market-configs.controller';
import { MarketConfigsService } from './market-configs.service';
import { MarketConfig } from './entities/market-config.entity';
import { PricesModule } from '../prices/prices.module';

@Module({
  imports: [TypeOrmModule.forFeature([MarketConfig]), PricesModule],
  controllers: [MarketConfigsController],
  providers: [MarketConfigsService],
  exports: [MarketConfigsService],
})
export class MarketConfigsModule {}
