import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StrategyConfigsController } from './strategy-configs.controller';
import { StrategyConfigsService } from './strategy-configs.service';
import { StrategyConfig } from './entities/strategy-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StrategyConfig])],
  controllers: [StrategyConfigsController],
  providers: [StrategyConfigsService],
  exports: [StrategyConfigsService],
})
export class StrategyConfigsModule {}
