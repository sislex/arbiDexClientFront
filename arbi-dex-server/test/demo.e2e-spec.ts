import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { Wallet } from 'ethers';
import { DataSource } from 'typeorm';
import { appConfig, dbConfig, jwtConfig, marketDataConfig } from '../src/config/configuration';
import { AuthModule } from '../src/auth/auth.module';
import { CatalogModule } from '../src/catalog/catalog.module';
import { ConditionsCatalogModule } from '../src/conditions-catalog/conditions-catalog.module';
import { MarketConfigsModule } from '../src/market-configs/market-configs.module';
import { StrategyConfigsModule } from '../src/strategy-configs/strategy-configs.module';
import { BotsModule } from '../src/bots/bots.module';
import { User } from '../src/users/entities/user.entity';
import { Subscription } from '../src/subscriptions/entities/subscription.entity';
import { UserSettings } from '../src/settings/entities/user-settings.entity';
import { Source } from '../src/catalog/entities/source.entity';
import { TradingPair } from '../src/catalog/entities/trading-pair.entity';
import { ArbiConfig } from '../src/arbi-configs/entities/arbi-config.entity';
import { ArbiConfigSource } from '../src/arbi-configs/entities/arbi-config-source.entity';
import { MarketConfig } from '../src/market-configs/entities/market-config.entity';
import { StrategyConfig } from '../src/strategy-configs/entities/strategy-config.entity';
import { Bot } from '../src/bots/entities/bot.entity';
import { seedCatalog } from '../src/database/seed';

/** End-to-end coverage of the new demo modules: configs → bot → backtest → autotune. */
describe('Demo API (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig, dbConfig, jwtConfig, marketDataConfig], envFilePath: '.env' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: parseInt(process.env.DB_PORT ?? '5433', 10),
          username: process.env.DB_USER ?? 'arbidex',
          password: process.env.DB_PASSWORD ?? 'arbidex_pass',
          database: process.env.DB_NAME ?? 'arbidex_db',
          entities: [User, Subscription, UserSettings, Source, TradingPair, ArbiConfig, ArbiConfigSource, MarketConfig, StrategyConfig, Bot],
          synchronize: true,
          logging: false,
        }),
        AuthModule,
        CatalogModule,
        ConditionsCatalogModule,
        MarketConfigsModule,
        StrategyConfigsModule,
        BotsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await seedCatalog(moduleFixture.get(DataSource));

    // Wallet login with a random key → fresh user.
    const wallet = Wallet.createRandom();
    const address = wallet.address.toLowerCase();
    const http = request(app.getHttpServer());
    const { body: nonceBody } = await http.post('/api/auth/nonce').send({ walletAddress: address }).expect(200);
    const signature = await wallet.signMessage(`Войти в ArbiDex\nNonce: ${nonceBody.nonce}`);
    const { body: verifyBody } = await http
      .post('/api/auth/verify')
      .send({ walletAddress: address, signature, walletProvider: 'MetaMask' })
      .expect(200);
    token = verifyBody.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => request(app.getHttpServer());

  it('serves the markets catalog and conditions catalog', async () => {
    const markets = await auth().get('/api/catalog/markets').set('Authorization', `Bearer ${token}`).expect(200);
    // Count is environment-derived (live market-data keys), so assert structure, not a fixed number.
    expect(Array.isArray(markets.body)).toBe(true);
    expect(markets.body.length).toBeGreaterThan(0);
    expect(markets.body[0]).toHaveProperty('sourceId');
    expect(markets.body[0]).toHaveProperty('pairId');
    const cat = await auth().get('/api/conditions-catalog').set('Authorization', `Bearer ${token}`).expect(200);
    expect(cat.body).toHaveLength(9);
  });

  it('runs the full flow: configs → bot → backtest (updates demo account) → autotune', async () => {
    const bearer = `Bearer ${token}`;

    // Market config
    const mc = await auth()
      .post('/api/market-configs')
      .set('Authorization', bearer)
      .send({
        name: 'E2E ETH',
        tradingMarketId: 'dex_arbitrum__WETH_USDC',
        observedMarketIds: ['cex_binance__ETH_USDT', 'cex_bybit__ETH_USDT'],
        useWeightedAverage: true,
      })
      .expect(201);
    expect(typeof mc.body.id).toBe('string');
    expect(typeof mc.body.createdAt).toBe('string');

    // Quotes for the chart
    const quotes = await auth()
      .get(`/api/market-configs/${mc.body.id}/quotes?count=120`)
      .set('Authorization', bearer)
      .expect(200);
    expect(quotes.body).toHaveLength(120);
    expect(quotes.body[0]).toHaveProperty('buyQuote');

    // Strategy config from defaults
    const defaults = await auth().get('/api/strategy-configs/defaults').set('Authorization', bearer).expect(200);
    const st = await auth()
      .post('/api/strategy-configs')
      .set('Authorization', bearer)
      .send({ name: 'E2E strat', buy: defaults.body.buy, sell: defaults.body.sell })
      .expect(201);
    expect(st.body.buy.length).toBeGreaterThan(0);

    // Bot linking both configs
    const bot = await auth()
      .post('/api/bots')
      .set('Authorization', bearer)
      .send({ name: 'E2E bot', mode: 'demo-live', marketConfigId: mc.body.id, strategyConfigId: st.body.id, initialBalance: 1000 })
      .expect(201);
    expect(bot.body.balance).toBe(1000);
    expect(bot.body.baseAsset).toBe('WETH');

    // Backtest → trades + demo account updated
    const bt = await auth().post(`/api/bots/${bot.body.id}/backtest?count=180`).set('Authorization', bearer).expect(201);
    expect(bt.body.trades.length).toBeGreaterThan(0);
    expect(bt.body.stats.trades).toBe(bt.body.trades.length);

    const refreshed = await auth().get(`/api/bots/${bot.body.id}`).set('Authorization', bearer).expect(200);
    expect(refreshed.body.balance).toBeCloseTo(bt.body.stats.finalBalance, 2);
    expect(refreshed.body.tradesCount).toBe(bt.body.stats.trades);

    // Autotune → ranked combos
    const at = await auth()
      .post(`/api/bots/${bot.body.id}/autotune?count=180&maxCombos=24`)
      .set('Authorization', bearer)
      .expect(201);
    expect(at.body.combos.length).toBeGreaterThan(1);
    expect(at.body.best).not.toBeNull();
    for (let i = 1; i < at.body.combos.length; i++) {
      expect(at.body.combos[i - 1].stats.pnl).toBeGreaterThanOrEqual(at.body.combos[i].stats.pnl);
    }

    // Cleanup
    await auth().delete(`/api/bots/${bot.body.id}`).set('Authorization', bearer).expect(204);
    await auth().delete(`/api/strategy-configs/${st.body.id}`).set('Authorization', bearer).expect(204);
    await auth().delete(`/api/market-configs/${mc.body.id}`).set('Authorization', bearer).expect(204);
  });
});
