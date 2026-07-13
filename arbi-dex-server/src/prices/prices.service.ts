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

/** Прореживает массив до max точек равномерно, сохраняя первую и последнюю. */
function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = (arr.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  private readonly marketDataUrl: string;

  /** TTL кэша — 1 час (в мс) */
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000;

  /** In-memory кэш: `${sourceId}|${pairId}` → { data, cachedAt } */
  private readonly cache = new Map<string, { data: SubscriptionPriceData; cachedAt: number }>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Subscription)
    private readonly subsRepo: Repository<Subscription>,
  ) {
    this.marketDataUrl = this.configService.getOrThrow<string>('marketData.url');
  }

  /**
   * Ценовые данные по подписке (с проверкой владельца — anti-IDOR).
   */
  async getPricesBySubscription(
    subscriptionId: string,
    userId: string,
    noCache = false,
  ): Promise<SubscriptionPriceData> {
    const sub = await this.subsRepo.findOne({ where: { id: subscriptionId, userId } });
    if (!sub) throw new NotFoundException('Подписка не найдена');
    return this.fetchByPair(sub.sourceId, sub.pairId, noCache);
  }

  /**
   * Реальные ценовые данные по рынку (source + pair) без подписки.
   * Используется страницей конфигурации рынков нового фронта.
   */
  getPricesByMarket(sourceId: string, pairId: string, noCache = false): Promise<SubscriptionPriceData> {
    return this.fetchByPair(sourceId, pairId, noCache);
  }

  /**
   * Тянет и трансформирует историю bid/ask из arbiDexMarketData по sourceId+pairId.
   * DEX → серии bid/ask; CEX → одна серия mid. Кэш на 1 час по паре.
   */
  private async fetchByPair(
    sourceId: string,
    pairId: string,
    noCache: boolean,
  ): Promise<SubscriptionPriceData> {
    const cacheKey = `${sourceId}|${pairId}`;
    if (!noCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < PricesService.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // Определяем формат ключей market-data (pipe / concat).
    let format: 'pipe' | 'concat' = 'concat';
    try {
      const keysResp = await firstValueFrom(
        this.httpService.get<string[]>(`${this.marketDataUrl}/store/keys`),
      );
      format = detectKeyFormat(keysResp.data);
    } catch {
      /* формат по умолчанию */
    }

    const keys = buildStoreKeys(sourceId, pairId, format);
    if (!keys) {
      throw new BadRequestException(
        `Не удалось построить ключи для sourceId="${sourceId}", pairId="${pairId}".`,
      );
    }

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
        `Не удалось получить данные от сервиса котировок (${this.marketDataUrl}).`,
      );
    }

    const bidPoints: BotsPricePoint[] = botsData[bidKey]?.points ?? [];
    const askPoints: BotsPricePoint[] = botsData[askKey]?.points ?? [];
    const isDex = sourceId.startsWith('dex');

    const timeMap = new Map<number, ChartPricePoint>();
    for (const p of bidPoints) timeMap.set(p.t, { time: p.t, bidPrice: p.v, askPrice: 0 });
    for (const p of askPoints) {
      const existing = timeMap.get(p.t);
      if (existing) existing.askPrice = p.v;
      else timeMap.set(p.t, { time: p.t, bidPrice: 0, askPrice: p.v });
    }

    const merged = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
    let lastBid = 0;
    let lastAsk = 0;
    for (const point of merged) {
      if (point.bidPrice === 0 && lastBid !== 0) point.bidPrice = lastBid;
      if (point.askPrice === 0 && lastAsk !== 0) point.askPrice = lastAsk;
      lastBid = point.bidPrice;
      lastAsk = point.askPrice;
    }

    // Прореживаем историю до ~800 точек (сервис отдаёт десятки тысяч) — чтобы
    // график грузился быстро; первая и последняя точки сохраняются.
    const sorted = downsample(merged, 800);

    const sourceName = SOURCE_META[sourceId]?.displayName ?? sourceId;
    let result: SubscriptionPriceData;
    if (isDex) {
      result = {
        series: [
          { key: 'bidPrice', name: `${sourceName} Bid`, color: '#0ecb81' },
          { key: 'askPrice', name: `${sourceName} Ask`, color: '#f6465d' },
        ],
        data: sorted,
      };
    } else {
      const midData: ChartPricePoint[] = sorted.map((point) => ({
        time: point.time,
        midPrice:
          point.bidPrice > 0 && point.askPrice > 0
            ? (point.bidPrice + point.askPrice) / 2
            : point.bidPrice || point.askPrice,
      }));
      result = {
        series: [{ key: 'midPrice', name: `${sourceName} Mid`, color: '#2196f3' }],
        data: midData,
      };
    }

    this.cache.set(cacheKey, { data: result, cachedAt: Date.now() });
    return result;
  }
}
