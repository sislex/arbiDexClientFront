import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { TradingSettingsController } from './trading-settings.controller';
import { TradingSettingsService } from './trading-settings.service';
import { UserSettings } from './entities/user-settings.entity';
import { UserTradingContract } from './entities/user-trading-contract.entity';
import { UserToken } from './entities/user-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings, UserTradingContract, UserToken])],
  controllers: [SettingsController, TradingSettingsController],
  providers: [SettingsService, TradingSettingsService],
  exports: [SettingsService, TradingSettingsService],
})
export class SettingsModule {}
