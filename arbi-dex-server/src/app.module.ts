import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig, dbConfig, jwtConfig, marketDataConfig } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SettingsModule } from './settings/settings.module';
import { CatalogModule } from './catalog/catalog.module';
import { PricesModule } from './prices/prices.module';
import { QuotesModule } from './quotes/quotes.module';
import { LiveChartModule } from './live-chart/live-chart.module';
import { User } from './users/entities/user.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { UserSettings } from './settings/entities/user-settings.entity';
import { Source } from './catalog/entities/source.entity';
import { TradingPair } from './catalog/entities/trading-pair.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, marketDataConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('db.host'),
        port: cfg.get<number>('db.port'),
        username: cfg.get<string>('db.username'),
        password: cfg.get<string>('db.password'),
        database: cfg.get<string>('db.database'),
        entities: [User, Subscription, UserSettings, Source, TradingPair],
        synchronize: true, // TODO: заменить на миграции для production
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
  ],
  controllers: [AppController],
})
export class AppModule {}
