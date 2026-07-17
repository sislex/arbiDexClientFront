import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotsController } from './bots.controller';
import { ComputeController } from './compute.controller';
import { BotsService } from './bots.service';
import { LiveTradingService } from './live-trading.service';
import { LiveEngineService } from './live-engine.service';
import { AutotuneJobsService } from './autotune-jobs.service';
import { AutotuneProgressGateway } from './autotune-progress.gateway';
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('jwt.accessSecret'),
      }),
    }),
  ],
  controllers: [BotsController, ComputeController],
  providers: [BotsService, LiveTradingService, LiveEngineService, AutotuneJobsService, AutotuneProgressGateway],
})
export class BotsModule {}
