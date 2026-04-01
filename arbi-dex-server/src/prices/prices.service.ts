import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { buildStoreKeys, detectKeyFormat, SOURCE_META } from './market-data-keys';

/** Точка из PriceStore arbiDexServerBots */
interface BotsPricePoint {
  t: number; // timestamp ms
  v: number; // value
}

/** Ответ от /prices/keys (POST) — каждый ключ содержит объект с полем points */
interface BotsPriceKeyData {
  points: BotsPricePoint[];
  count?: number;
  last?: BotsPricePoint;
}

interface BotsPriceKeysResponse {
  [key: string]: BotsPriceKeyData;
}

/** Конфиг серии для фронтенда */
export interface PriceSeriesConfig {
  key: string;
  name: string;
  color: string;
}

/** Точка данных для фронтенда */
export interface ChartPricePoint {
  time: number;
  [field: string]: number;
}

/** Полный ответ для фронтенда */
export interface SubscriptionPriceData {
  series: PriceSeriesConfig[];
  data: ChartPricePoint[];
}

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private readonly marketDataUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Subscription)
    private readonly subsRepo: Repository<Subscription>,
  ) {
    this.marketDataUrl = this.configService.get<string>('marketData.url') ?? 'http://45.135.182.251:3002';
  }

  /**
   * Получить ценовые данные по subscriptionId.
   * Маппит sourceId+pairId → ключи PriceStore, запрашивает историю из arbiDexServerBots,
   * трансформирует в формат PriceChartComponent.
   */
  async getPricesBySubscription(subscriptionId: string, userId: string): Promise<SubscriptionPriceData> {
    // 1. Найти подписку
    const sub = await this.subsRepo.findOne({ where: { id: subscriptionId, userId } });
    if (!sub) {
      throw new NotFoundException('Подписка не найдена');
    }

    // 2. Определяем формат ключей и строим bid/ask ключи
    let format: 'pipe' | 'concat' = 'concat';
    try {
      const keysResp = await firstValueFrom(
        this.httpService.get<string[]>(`${this.marketDataUrl}/store/keys`),
      );
      format = detectKeyFormat(keysResp.data);
    } catch {
      // используем формат по умолчанию
    }

    const keys = buildStoreKeys(sub.sourceId, sub.pairId, format);
    if (!keys) {
      throw new BadRequestException(
        `Не удалось построить ключи для sourceId="${sub.sourceId}", pairId="${sub.pairId}".`,
      );
    }

    // 3. Запрос к arbiDexMarketData
    const { bidKey, askKey } = keys;
    let botsData: BotsPriceKeysResponse;

    try {
      const response = await firstValueFrom(
        this.httpService.post<BotsPriceKeysResponse>(`${this.marketDataUrl}/store/keys`, {
          keys: [bidKey, askKey],
        }),
      );
      botsData = response.data;
    } catch (error) {
      this.logger.error(`Ошибка при запросе к arbiDexMarketData: ${error.message}`);
      throw new BadRequestException(
        `Не удалось получить данные от сервиса котировок (${this.marketDataUrl}). ` +
        `Убедитесь что arbiDexMarketData запущен.`,
      );
    }

    // 4. Трансформация в формат PriceChartComponent
    const bidPoints: BotsPricePoint[] = botsData[bidKey]?.points ?? [];
    const askPoints: BotsPricePoint[] = botsData[askKey]?.points ?? [];

    // Merge bid и ask по timestamp с помощью Map
    const timeMap = new Map<number, ChartPricePoint>();

    for (const p of bidPoints) {
      timeMap.set(p.t, { time: p.t, bidPrice: p.v, askPrice: 0 });
    }

    for (const p of askPoints) {
      const existing = timeMap.get(p.t);
      if (existing) {
        existing.askPrice = p.v;
      } else {
        timeMap.set(p.t, { time: p.t, bidPrice: 0, askPrice: p.v });
      }
    }

    // Сортировка по времени, заполнение пропусков предыдущим значением
    const sorted = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);

    let lastBid = 0;
    let lastAsk = 0;
    for (const point of sorted) {
      if (point.bidPrice === 0 && lastBid !== 0) point.bidPrice = lastBid;
      if (point.askPrice === 0 && lastAsk !== 0) point.askPrice = lastAsk;
      lastBid = point.bidPrice;
      lastAsk = point.askPrice;
    }

    // 5. Конфиг серий
    const sourceName = SOURCE_META[sub.sourceId]?.displayName ?? sub.sourceId;
    const series: PriceSeriesConfig[] = [
      { key: 'bidPrice', name: `${sourceName} Bid`, color: '#0ecb81' },
      { key: 'askPrice', name: `${sourceName} Ask`, color: '#f6465d' },
    ];

    return { series, data: sorted };
  }
}
