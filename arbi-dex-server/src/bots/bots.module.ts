import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';
import { LiveTradingService } from './live-trading.service';
import { Bot } from './entities/bot.entity';
import { BotTrade } from './entities/bot-trade.entity';
import { MarketConfigsModule } from '../market-configs/market-configs.module';
import { StrategyConfigsModule } from '../strategy-configs/strategy-configs.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { SwapExecutionModule } from '../swap-execution/swap-execution.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bot, BotTrade]),
    MarketConfigsModule,
    StrategyConfigsModule,
    MarketDataModule,
    SwapExecutionModule,
    SettingsModule,
  ],
  controllers: [BotsController],
  providers: [BotsService, LiveTradingService],
})
export class BotsModule {}
