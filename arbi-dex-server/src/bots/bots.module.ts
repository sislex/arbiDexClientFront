import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';
import { Bot } from './entities/bot.entity';
import { MarketConfigsModule } from '../market-configs/market-configs.module';
import { StrategyConfigsModule } from '../strategy-configs/strategy-configs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bot]), MarketConfigsModule, StrategyConfigsModule],
  controllers: [BotsController],
  providers: [BotsService],
})
export class BotsModule {}
