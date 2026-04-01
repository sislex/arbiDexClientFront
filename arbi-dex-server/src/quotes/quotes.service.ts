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

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);
  private readonly marketDataUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.marketDataUrl =
      this.configService.get<string>('marketData.url') ?? 'http://45.135.182.251:3002';
  }

  /**
   * Получить последние котировки из arbiDexMarketData.
   * Запрашивает /store/snapshot, группирует bid/ask по source+pair,
   * маппит обратно на sourceId/pairId.
   */
  async getLatestQuotes(): Promise<QuoteDto[]> {
    let snapshot: SnapshotResponse;

    try {
      const response = await firstValueFrom(
        this.httpService.get<SnapshotResponse>(`${this.marketDataUrl}/store/snapshot`),
      );
      snapshot = response.data;
    } catch (error) {
      this.logger.error(`Ошибка при запросе snapshot из arbiDexMarketData: ${error.message}`);
      return [];
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
