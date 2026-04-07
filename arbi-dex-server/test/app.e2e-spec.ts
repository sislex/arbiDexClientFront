import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { appConfig, dbConfig, jwtConfig } from '../src/config/configuration';
import { AuthModule } from '../src/auth/auth.module';
import { SubscriptionsModule } from '../src/subscriptions/subscriptions.module';
import { SettingsModule } from '../src/settings/settings.module';
import { CatalogModule } from '../src/catalog/catalog.module';
import { AppController } from '../src/app.controller';
import { User } from '../src/users/entities/user.entity';
import { Subscription } from '../src/subscriptions/entities/subscription.entity';
import { UserSettings } from '../src/settings/entities/user-settings.entity';
import { Source } from '../src/catalog/entities/source.entity';
import { TradingPair } from '../src/catalog/entities/trading-pair.entity';
import { seedCatalog } from '../src/database/seed';
import { DataSource } from 'typeorm';

const VALID_TEST_ADDRESS = '0xBD7FAad22C63069C2ef2aF0904A8d40fddF8A858';

describe('ArbiDex API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let createdSubId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig, dbConfig, jwtConfig],
          envFilePath: '.env',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: parseInt(process.env.DB_PORT ?? '5433', 10),
          username: process.env.DB_USER ?? 'arbidex',
          password: process.env.DB_PASSWORD ?? 'arbidex_pass',
          database: process.env.DB_NAME ?? 'arbidex_db',
          entities: [User, Subscription, UserSettings, Source, TradingPair],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        AuthModule,
        SubscriptionsModule,
        SettingsModule,
        CatalogModule,
      ],
      controllers: [AppController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    await seedCatalog(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Health ──────────────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('200 — сервер работает', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });
  });

  // ── Auth: Nonce ─────────────────────────────────────────────────────────────

  describe('POST /api/auth/nonce', () => {
    it('200 — возвращает nonce для нового пользователя', () => {
      return request(app.getHttpServer())
        .post('/api/auth/nonce')
        .send({ walletAddress: VALID_TEST_ADDRESS })
        .expect(200)
        .expect((res) => {
          expect(typeof res.body.nonce).toBe('string');
          expect(res.body.nonce.length).toBeGreaterThan(0);
        });
    });

    it('200 — каждый вызов генерирует новый nonce', async () => {
      const r1 = await request(app.getHttpServer()).post('/api/auth/nonce').send({ walletAddress: VALID_TEST_ADDRESS });
      const r2 = await request(app.getHttpServer()).post('/api/auth/nonce').send({ walletAddress: VALID_TEST_ADDRESS });
      expect(r1.body.nonce).not.toBe(r2.body.nonce);
    });

    it('400 — некорректный адрес кошелька', () => {
      return request(app.getHttpServer())
        .post('/api/auth/nonce')
        .send({ walletAddress: 'not-an-address' })
        .expect(400);
    });

    it('400 — отсутствует walletAddress', () => {
      return request(app.getHttpServer()).post('/api/auth/nonce').send({}).expect(400);
    });
  });

  // ── Auth: Verify (без корректной подписи) ──────────────────────────────────

  describe('POST /api/auth/verify — негативные сценарии', () => {
    it('400/401 — неверная подпись', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/nonce')
        .send({ walletAddress: VALID_TEST_ADDRESS });

      return request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({
          walletAddress: VALID_TEST_ADDRESS,
          signature: '0x' + 'a'.repeat(130),
        })
        .expect((res) => expect([400, 401]).toContain(res.status));
    });

    it('400 — отсутствует signature', () => {
      return request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ walletAddress: VALID_TEST_ADDRESS })
        .expect(400);
    });
  });

  // ── Auth: Refresh ───────────────────────────────────────────────────────────

  describe('POST /api/auth/refresh — негативные сценарии', () => {
    it('401 — невалидный refresh-токен', () => {
      return request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);
    });

    it('400 — отсутствует refreshToken', () => {
      return request(app.getHttpServer()).post('/api/auth/refresh').send({}).expect(400);
    });
  });

  // ── Защита без токена ───────────────────────────────────────────────────────

  describe('Защищённые маршруты без JWT', () => {
    it('GET /api/subscriptions → 401', () => request(app.getHttpServer()).get('/api/subscriptions').expect(401));
    it('POST /api/subscriptions → 401', () => request(app.getHttpServer()).post('/api/subscriptions').expect(401));
    it('GET /api/settings → 401', () => request(app.getHttpServer()).get('/api/settings').expect(401));
    it('GET /api/catalog/sources → 401', () => request(app.getHttpServer()).get('/api/catalog/sources').expect(401));
    it('GET /api/catalog/pairs → 401', () => request(app.getHttpServer()).get('/api/catalog/pairs').expect(401));
  });

  // ── Полный e2e-сценарий ─────────────────────────────────────────────────────

  describe('Полный сценарий: Web3 Auth → Subscriptions → Settings → Catalog', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ethers } = require('ethers');
    // Тестовый ключ из Hardhat (публичный, для тестов)
    const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const wallet = new ethers.Wallet(TEST_PRIVATE_KEY);
    const walletAddress: string = wallet.address;

    it('1. запрашивает nonce', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/nonce')
        .send({ walletAddress });
      expect(res.status).toBe(200);
      expect(res.body.nonce).toBeDefined();
    });

    it('2. подписывает nonce и получает JWT-токены', async () => {
      const nonceRes = await request(app.getHttpServer())
        .post('/api/auth/nonce')
        .send({ walletAddress });
      const nonce = nonceRes.body.nonce as string;
      const signature = await wallet.signMessage(`Войти в ArbiDex\nNonce: ${nonce}`);

      const res = await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ walletAddress, signature, walletProvider: 'MetaMask' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.walletAddress).toBe(walletAddress.toLowerCase());
      accessToken = res.body.accessToken as string;
    });

    it('3. список подписок пуст', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('4. создаёт подписку', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ sourceId: 'cex_binance', pairId: 'ETH_USDT' });
      expect(res.status).toBe(201);
      expect(res.body.sourceId).toBe('cex_binance');
      expect(res.body.pairId).toBe('ETH_USDT');
      expect(res.body.enabled).toBe(true);
      createdSubId = res.body.id as string;
    });

    it('4a. 400 — создание подписки без sourceId', () => {
      return request(app.getHttpServer())
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pairId: 'ETH_USDT' })
        .expect(400);
    });

    it('5. список содержит 1 подписку', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.body).toHaveLength(1);
    });

    it('6. toggle → enabled: false', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/subscriptions/${createdSubId}/toggle`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });

    it('6a. toggle снова → enabled: true', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/subscriptions/${createdSubId}/toggle`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.body.enabled).toBe(true);
    });

    it('6b. 404 — toggle несуществующей подписки', () => {
      return request(app.getHttpServer())
        .patch('/api/subscriptions/00000000-0000-0000-0000-000000000000/toggle')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('7. настройки по умолчанию', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/settings')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.theme).toBe('light');
      expect(res.body.density).toBe('default');
      expect(res.body.sidebarOpened).toBe(true);
    });

    it('8. обновляет тему на dark', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ theme: 'dark' });
      expect(res.status).toBe(200);
      expect(res.body.theme).toBe('dark');
      expect(res.body.density).toBe('default');
    });

    it('8a. 400 — недопустимое значение theme', () => {
      return request(app.getHttpServer())
        .patch('/api/settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ theme: 'blue' })
        .expect(400);
    });

    it('9. каталог источников (≥4 активных)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/sources')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
      expect(res.body.every((s: any) => s.isActive)).toBe(true);
    });

    it('10. каталог торговых пар (≥4)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/catalog/pairs')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
      expect(res.body[0]).toMatchObject({ id: expect.any(String), base: expect.any(String) });
    });

    it('11. удаляет подписку → 204', async () => {
      await request(app.getHttpServer())
        .delete(`/api/subscriptions/${createdSubId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const list = await request(app.getHttpServer())
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(list.body).toHaveLength(0);
    });

    it('11a. 404 — удаление несуществующей подписки', () => {
      return request(app.getHttpServer())
        .delete('/api/subscriptions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('12. refresh-токен выдаёт новую пару токенов', async () => {
      const nonceRes = await request(app.getHttpServer())
        .post('/api/auth/nonce').send({ walletAddress });
      const signature = await wallet.signMessage(
        `Войти в ArbiDex\nNonce: ${nonceRes.body.nonce}`,
      );
      const verifyRes = await request(app.getHttpServer())
        .post('/api/auth/verify').send({ walletAddress, signature });
      const refreshToken = verifyRes.body.refreshToken as string;

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });
  });
});
