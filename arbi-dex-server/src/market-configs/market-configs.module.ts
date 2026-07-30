import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketConfigsController } from './market-configs.controller';
import { MarketConfigsService } from './market-configs.service';
import { MarketConfig } from './entities/market-config.entity';
import { PricesModule } from '../prices/prices.module';
import { Bot } from '../bots/entities/bot.entity';
import { BotSession } from '../bots/entities/bot-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketConfig, Bot, BotSession]), PricesModule],
  controllers: [MarketConfigsController],
  providers: [MarketConfigsService],
  exports: [MarketConfigsService],
})
export class MarketConfigsModule {}
