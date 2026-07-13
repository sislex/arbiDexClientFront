import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Source } from './entities/source.entity';
import { TradingPair } from './entities/trading-pair.entity';
import {
  parseMarketDataKey,
  makePairId,
  makePairDisplayName,
  tokenDisplayName,
  SOURCE_META,
} from '../prices/market-data-keys';
import { MARKETS } from '../demo/engine/markets';
import type { Market } from '../demo/engine/types';

/** DTO источника для фронтенда */
export interface SourceDto {
  id: string;
  name: string;
  displayName: string;
  type: 'dex' | 'cex';
  icon: string | null;
  isActive: boolean;
}

/** DTO торговой пары для фронтенда */
export interface PairDto {
  id: string;
  base: string;
  quote: string;
  displayName: string;
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly marketDataUrl: string;

  constructor(
    @InjectRepository(Source)
    private readonly sourcesRepo: Repository<Source>,
    @InjectRepository(TradingPair)
    private readonly pairsRepo: Repository<TradingPair>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.marketDataUrl =
      this.configService.get<string>('marketData.url') ?? 'http://45.135.182.251:3002';
  }

  /**
   * Получить список источников из ключей arbiDexMarketData.
   * Если сервис недоступен — fallback на БД.
   */
  async getSources(): Promise<SourceDto[]> {
    try {
      const keys = await this.fetchMarketDataKeys();
      return this.deriveSources(keys);
    } catch (err) {
      this.logger.warn(`Fallback на БД для sources: ${err.message}`);
      const dbSources = await this.sourcesRepo.find({ where: { isActive: true } });
      return dbSources.map((s) => ({
        ...s,
        type: s.type as 'dex' | 'cex',
        icon: s.icon ?? null,
      }));
    }
  }

  /**
   * Список рынков (источник × пара) для нового фронта, выведенный из живых
   * ключей arbiDexMarketData — у каждого рынка есть реальные котировки.
   * Id: `${sourceId}__${pairId}`. Fallback на статичный список, если сервис недоступен.
   */
  async getMarkets(): Promise<Market[]> {
    try {
      const keys = await this.fetchMarketDataKeys();
      const seen = new Map<string, Market>();
      for (const key of keys) {
        const parsed = parseMarketDataKey(key);
        if (!parsed) continue;
        const pairId = makePairId(parsed.base, parsed.quote);
        const id = `${parsed.source}__${pairId}`;
        if (seen.has(id)) continue;
        const meta = SOURCE_META[parsed.source];
        seen.set(id, {
          id,
          sourceId: parsed.source,
          sourceName: meta?.displayName ?? parsed.source,
          kind: meta?.type ?? (parsed.source.startsWith('dex') ? 'dex' : 'cex'),
          pairId,
          base: tokenDisplayName(parsed.base),
          quote: tokenDisplayName(parsed.quote),
        });
      }
      const markets = Array.from(seen.values());
      if (markets.length) {
        return markets.sort((a, b) => a.kind.localeCompare(b.kind) || a.sourceName.localeCompare(b.sourceName));
      }
    } catch (err) {
      this.logger.warn(`Fallback на статичные рынки: ${err.message}`);
    }
    return MARKETS;
  }

  /**
   * Получить список торговых пар из ключей arbiDexMarketData.
   * Если сервис недоступен — fallback на БД.
   */
  async getPairs(): Promise<PairDto[]> {
    try {
      const keys = await this.fetchMarketDataKeys();
      return this.derivePairs(keys);
    } catch (err) {
      this.logger.warn(`Fallback на БД для pairs: ${err.message}`);
      return this.pairsRepo.find();
    }
  }

  /**
   * Получить торговые пары, доступные для конкретного источника.
   * Фильтрует ключи arbiDexMarketData по sourceId.
   */
  async getPairsBySource(sourceId: string): Promise<PairDto[]> {
    try {
      const keys = await this.fetchMarketDataKeys();
      return this.derivePairs(keys, sourceId);
    } catch (err) {
      this.logger.warn(`Fallback на БД для pairs (source=${sourceId}): ${err.message}`);
      return this.pairsRepo.find();
    }
  }

  /** Запрос GET /store/keys из arbiDexMarketData */
  private async fetchMarketDataKeys(): Promise<string[]> {
    const response = await firstValueFrom(
      this.httpService.get<string[]>(`${this.marketDataUrl}/store/keys`),
    );
    return response.data;
  }

  /** Извлечь уникальные источники из ключей */
  private deriveSources(keys: string[]): SourceDto[] {
    const seen = new Map<string, SourceDto>();

    for (const key of keys) {
      const parsed = parseMarketDataKey(key);
      if (!parsed) continue;

      if (!seen.has(parsed.source)) {
        const meta = SOURCE_META[parsed.source];
        seen.set(parsed.source, {
          id: parsed.source,
          name: parsed.source,
          displayName: meta?.displayName ?? parsed.source,
          type: meta?.type ?? (parsed.source.startsWith('dex:') ? 'dex' : 'cex'),
          icon: null,
          isActive: true,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) =>
      a.type.localeCompare(b.type) || a.displayName.localeCompare(b.displayName),
    );
  }

  /** Извлечь уникальные торговые пары из ключей, опционально фильтруя по источнику */
  private derivePairs(keys: string[], sourceFilter?: string): PairDto[] {
    const seen = new Map<string, PairDto>();

    for (const key of keys) {
      const parsed = parseMarketDataKey(key);
      if (!parsed) continue;
      if (sourceFilter && parsed.source !== sourceFilter) continue;

      const pairId = makePairId(parsed.base, parsed.quote);
      if (!seen.has(pairId)) {
        seen.set(pairId, {
          id: pairId,
          base: tokenDisplayName(parsed.base),
          quote: tokenDisplayName(parsed.quote),
          displayName: makePairDisplayName(parsed.base, parsed.quote),
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }
}
