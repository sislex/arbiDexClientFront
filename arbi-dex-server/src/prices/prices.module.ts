import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { Subscription } from '../subscriptions/entities/subscription.entity';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000 }),
    TypeOrmModule.forFeature([Subscription]),
  ],
  controllers: [PricesController],
  providers: [PricesService],
})
export class PricesModule {}

