import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArbiConfigsController } from './arbi-configs.controller';
import { ArbiConfigsService } from './arbi-configs.service';
import { ArbiConfig } from './entities/arbi-config.entity';
import { ArbiConfigSource } from './entities/arbi-config-source.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { PricesModule } from '../prices/prices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArbiConfig, ArbiConfigSource, Subscription]),
    PricesModule,
  ],
  controllers: [ArbiConfigsController],
  providers: [ArbiConfigsService],
  exports: [ArbiConfigsService],
})
export class ArbiConfigsModule {}

