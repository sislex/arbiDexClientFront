import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StrategyConfigsController } from './strategy-configs.controller';
import { StrategyConfigsService } from './strategy-configs.service';
import { StrategyConfig } from './entities/strategy-config.entity';
import { Bot } from '../bots/entities/bot.entity';
import { BotSession } from '../bots/entities/bot-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StrategyConfig, Bot, BotSession])],
  controllers: [StrategyConfigsController],
  providers: [StrategyConfigsService],
  exports: [StrategyConfigsService],
})
export class StrategyConfigsModule {}
