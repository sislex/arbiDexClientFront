import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { seedCatalog } from './database/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);

  // ── CORS ────────────────────────────────────────────────────────────────────
  const corsOriginRaw = cfg.get<string>('app.corsOrigin') ?? 'http://localhost:4200';
  // '*' несовместим с credentials: true — используем true (отражение Origin)
  const corsOrigin: string | boolean = corsOriginRaw === '*' ? true : corsOriginRaw;
  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Global prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Validation ──────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger ─────────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ArbiDex API')
    .setDescription(
      `## ArbiDex Backend API\n\n` +
      `REST API сервер для платформы мониторинга арбитражных возможностей ArbiDex.\n\n` +
      `### Аутентификация\n` +
      `Используется **Web3 Wallet Auth** (без паролей):\n` +
      `1. \`POST /api/auth/nonce\` — получить одноразовый nonce по адресу кошелька\n` +
      `2. Подписать строку \`"Войти в ArbiDex\\nNonce: <nonce>"\` в кошельке (MetaMask и др.)\n` +
      `3. \`POST /api/auth/verify\` — передать подпись, получить JWT-токены\n` +
      `4. Все защищённые эндпоинты требуют заголовок \`Authorization: Bearer <accessToken>\`\n\n` +
      `### Модули\n` +
      `- **Auth** — аутентификация через крипто-кошелёк + JWT\n` +
      `- **Subscriptions** — управление подписками пользователя на пары/источники\n` +
      `- **Settings** — пользовательские настройки интерфейса\n` +
      `- **Catalog** — справочник источников (бирж) и торговых пар`,
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addServer(`http://localhost:${cfg.get<number>('app.port')}`, 'Local')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // ── Seed ────────────────────────────────────────────────────────────────────
  const dataSource = app.get(DataSource);
  await seedCatalog(dataSource);

  // ── Start ───────────────────────────────────────────────────────────────────
  const port = cfg.get<number>('app.port') ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server running at http://localhost:${port}/api`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
