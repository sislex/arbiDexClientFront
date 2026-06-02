import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';

@Module({
  imports: [HttpModule.register({ timeout: 10000 })],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
