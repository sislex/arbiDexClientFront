import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  appConfig,
  dbConfig,
  jwtConfig,
  marketDataConfig,
  swapNetworksConfig,
} from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SettingsModule } from './settings/settings.module';
import { CatalogModule } from './catalog/catalog.module';
import { PricesModule } from './prices/prices.module';
import { QuotesModule } from './quotes/quotes.module';
import { LiveChartModule } from './live-chart/live-chart.module';
import { ArbiConfigsModule } from './arbi-configs/arbi-configs.module';
import { User } from './users/entities/user.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { UserSettings } from './settings/entities/user-settings.entity';
import { Source } from './catalog/entities/source.entity';
import { TradingPair } from './catalog/entities/trading-pair.entity';
import { ArbiConfig } from './arbi-configs/entities/arbi-config.entity';
import { ArbiConfigSource } from './arbi-configs/entities/arbi-config-source.entity';
import { SwapExecutionModule } from './swap-execution/swap-execution.module';
import { MarketDataModule } from './market-data/market-data.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, marketDataConfig, swapNetworksConfig],
    }),
    // Глобальный rate-limit: 100 запросов в минуту на IP (защита от abuse/DoS).
    // Более строгие лимиты на чувствительные эндпоинты — через @Throttle() на роутах.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('db.host'),
        port: cfg.get<number>('db.port'),
        username: cfg.get<string>('db.username'),
        password: cfg.get<string>('db.password'),
        database: cfg.get<string>('db.database'),
        entities: [User, Subscription, UserSettings, Source, TradingPair, ArbiConfig, ArbiConfigSource],
        // Никогда не синхронизируем схему автоматически в production (риск потери данных).
        // TODO: перейти на явные миграции.
        synchronize: cfg.get<string>('app.nodeEnv') !== 'production',
        logging: cfg.get<string>('app.nodeEnv') === 'development',
      }),
    }),
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    SettingsModule,
    CatalogModule,
    PricesModule,
    QuotesModule,
    LiveChartModule,
    ArbiConfigsModule,
    SwapExecutionModule,
    MarketDataModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
