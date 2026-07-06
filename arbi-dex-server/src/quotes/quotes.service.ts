import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  parseMarketDataKey,
  makePairId,
  SOURCE_META,
} from '../prices/market-data-keys';

/** Точка из arbiDexMarketData snapshot */
interface DataPoint {
  t: number;
  v: number;
}

/** Формат snapshot: ключ → последняя точка */
interface SnapshotResponse {
  [key: string]: DataPoint | null;
}

/** Котировка для фронтенда */
export interface QuoteDto {
  sourceId: string;
  pairId: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPct: number;
  timestamp: number;
}

/** Максимальный возраст последней точки, при котором котировка считается актуальной. */
const QUOTE_MAX_AGE_MS = 60_000;

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);
  private readonly marketDataUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.marketDataUrl = this.configService.getOrThrow<string>('marketData.url');
  }

  /**
   * Получить последние котировки из arbiDexMarketData.
   * Запрашивает /store/snapshot, группирует bid/ask по source+pair,
   * маппит обратно на sourceId/pairId.
   */
  async getLatestQuotes(): Promise<QuoteDto[]> {
    // arbiDexMarketData не отдаёт готовый snapshot одним запросом. Собираем его сами:
    //   1) GET  /store/keys        — список всех доступных ключей
    //   2) POST /store/keys {keys} — серии точек по нужным ключам
    // и берём последнюю (самую свежую) точку каждой серии.

    // 1. Список ключей → оставляем только bid/ask-price (parseMarketDataKey отсеет pool и пр.)
    let priceKeys: string[];
    try {
      const keysResp = await firstValueFrom(
        this.httpService.get<string[]>(`${this.marketDataUrl}/store/keys`),
      );
      priceKeys = (keysResp.data ?? []).filter((k) => parseMarketDataKey(k) !== null);
    } catch (error) {
      this.logger.error(`Ошибка при запросе ключей из arbiDexMarketData: ${error.message}`);
      return [];
    }
    if (priceKeys.length === 0) return [];

    // 2. Значения по ключам (серия точек на ключ)
    let series: Record<string, { points?: DataPoint[] } | null>;
    try {
      const response = await firstValueFrom(
        this.httpService.post<Record<string, { points?: DataPoint[] } | null>>(
          `${this.marketDataUrl}/store/keys`,
          { keys: priceKeys },
        ),
      );
      series = response.data ?? {};
    } catch (error) {
      this.logger.error(`Ошибка при запросе значений из arbiDexMarketData: ${error.message}`);
      return [];
    }

    // snapshot: ключ → самая свежая точка серии (по максимальному t),
    // но только если она не старше QUOTE_MAX_AGE_MS (иначе считаем ключ «протухшим»).
    const now = Date.now();
    const snapshot: SnapshotResponse = {};
    for (const [key, val] of Object.entries(series)) {
      const points = val?.points;
      if (!points || points.length === 0) {
        snapshot[key] = null;
        continue;
      }
      const latest = points.reduce((a, p) => (p.t >= a.t ? p : a));
      snapshot[key] = now - latest.t <= QUOTE_MAX_AGE_MS ? latest : null;
    }

    // Группируем bid/ask по ключу source+pair
    const groups = new Map<string, {
      sourceId: string;
      pairId: string;
      bid?: DataPoint;
      ask?: DataPoint;
    }>();

    for (const [key, point] of Object.entries(snapshot)) {
      if (!point) continue;

      const parsed = parseMarketDataKey(key);
      if (!parsed) {
        this.logger.debug(`Пропущен ключ без маппинга: ${key}`);
        continue;
      }

      const sourceId = parsed.source;
      const pairId = makePairId(parsed.base, parsed.quote);
      const groupKey = `${sourceId}::${pairId}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { sourceId, pairId });
      }

      const group = groups.get(groupKey)!;
      if (parsed.field === 'bidPrice') {
        group.bid = point;
      } else {
        group.ask = point;
      }
    }

    // Формируем массив котировок
    const quotes: QuoteDto[] = [];

    for (const group of groups.values()) {
      const bid = group.bid?.v ?? 0;
      const ask = group.ask?.v ?? 0;

      if (bid === 0 && ask === 0) continue;

      const mid = (bid + ask) / 2;
      const spread = ask - bid;
      const spreadPct = mid > 0 ? spread / mid : 0;
      const timestamp = Math.max(group.bid?.t ?? 0, group.ask?.t ?? 0);

      quotes.push({
        sourceId: group.sourceId,
        pairId: group.pairId,
        bid: +bid.toFixed(6),
        ask: +ask.toFixed(6),
        mid: +mid.toFixed(6),
        spread: +spread.toFixed(6),
        spreadPct: +spreadPct.toFixed(8),
        timestamp,
      });
    }

    // Сортируем: сначала по sourceId, потом по pairId
    quotes.sort((a, b) =>
      a.sourceId.localeCompare(b.sourceId) || a.pairId.localeCompare(b.pairId),
    );

    return quotes;
  }
}
