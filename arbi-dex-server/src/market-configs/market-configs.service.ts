import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketConfig } from './entities/market-config.entity';
import { CreateMarketConfigDto, UpdateMarketConfigDto } from './dto/market-config.dto';
import { generateQuoteSeries } from '../demo/engine/quotes';
import { basePriceForPair, findMarket, NOW } from '../demo/engine/markets';
import { QuotePoint } from '../demo/engine/types';
import { PricesService, ChartPricePoint } from '../prices/prices.service';

/** Real quote series for a market config plus the bounds of available history. */
export interface QuotesRangeResult {
  quotes: QuotePoint[];
  historyFrom: number;
  historyTo: number;
}

/** A market's data normalised to a bid/ask/mid tuple per timestamp. */
interface NormPoint {
  time: number;
  bid: number;
  ask: number;
  mid: number;
}

@Injectable()
export class MarketConfigsService {
  constructor(
    @InjectRepository(MarketConfig)
    private readonly repo: Repository<MarketConfig>,
    private readonly prices: PricesService,
  ) {}

  findAll(userId: string): Promise<MarketConfig[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findOne(userId: string, id: string): Promise<MarketConfig> {
    const mc = await this.repo.findOne({ where: { id, userId } });
    if (!mc) throw new NotFoundException('Конфигурация рынков не найдена');
    return mc;
  }

  create(userId: string, dto: CreateMarketConfigDto): Promise<MarketConfig> {
    const mc = this.repo.create({
      userId,
      name: dto.name,
      tradingMarketId: dto.tradingMarketId ?? null,
      observedMarketIds: dto.observedMarketIds ?? [],
      useWeightedAverage: dto.useWeightedAverage ?? true,
      weights: dto.weights ?? {},
    });
    return this.repo.save(mc);
  }

  async update(userId: string, id: string, dto: UpdateMarketConfigDto): Promise<MarketConfig> {
    const mc = await this.findOne(userId, id);
    Object.assign(mc, dto);
    return this.repo.save(mc);
  }

  async remove(userId: string, id: string): Promise<void> {
    const mc = await this.findOne(userId, id);
    await this.repo.remove(mc);
  }

  /** Deterministic historical quote series for the config's trading market. */
  async getQuotes(userId: string, id: string, count = 240, intervalSec = 60): Promise<QuotePoint[]> {
    const mc = await this.findOne(userId, id);
    const marketId = mc.tradingMarketId ?? mc.observedMarketIds[0];
    const market = marketId ? findMarket(marketId) : undefined;
    const pairId = market?.pairId ?? 'WETH_USDC';
    return generateQuoteSeries({
      seed: mc.id,
      count,
      intervalSec,
      endTime: NOW,
      basePrice: basePriceForPair(pairId),
    });
  }

  /**
   * Real quote series for the config's trading market over `[from, to]`, with the
   * observed markets folded into a (weighted) `avgObservedQuote`.
   *
   * The trading market drives the timeline: `buyQuote`=ask, `sellQuote`=bid. The
   * observed markets are forward-filled and averaged at each trading timestamp.
   * `historyFrom`/`historyTo` are the full available bounds (for UI clamping);
   * `quotes` is filtered to the requested window. Falls back to the deterministic
   * synthetic series when no real trading data is available (demo/tests).
   */
  async getQuotesRange(
    userId: string,
    id: string,
    from?: number,
    to?: number,
  ): Promise<QuotesRangeResult> {
    const mc = await this.findOne(userId, id);
    const tradingMarketId = mc.tradingMarketId ?? mc.observedMarketIds[0];

    const tradingSeries = tradingMarketId ? await this.fetchNorm(tradingMarketId) : [];
    if (tradingSeries.length === 0) {
      // No real data — synthesise a series and slice to the requested window.
      const synthetic = await this.getQuotes(userId, id, 800);
      return this.sliceSynthetic(synthetic, from, to);
    }

    // Observed series (excluding the trading market itself when it appears there).
    const observedIds = mc.observedMarketIds.filter((m) => m !== tradingMarketId);
    const observed = await Promise.all(observedIds.map((m) => this.fetchNorm(m)));
    const weights = mc.weights ?? {};

    // Forward-fill pointers per observed market.
    const cursors = observed.map(() => 0);

    const all: QuotePoint[] = tradingSeries.map((tp) => {
      let weightSum = 0;
      let acc = 0;
      observed.forEach((series, i) => {
        // Advance the cursor to the last point at or before this timestamp.
        while (cursors[i] + 1 < series.length && series[cursors[i] + 1].time <= tp.time) {
          cursors[i] += 1;
        }
        const pt = series[cursors[i]];
        if (pt && pt.time <= tp.time && pt.mid > 0) {
          const w = weights[observedIds[i]] ?? 1;
          acc += pt.mid * w;
          weightSum += w;
        }
      });
      const avgObservedQuote = weightSum > 0 ? acc / weightSum : tp.mid;
      return {
        time: tp.time,
        buyQuote: tp.ask,
        sellQuote: tp.bid,
        avgObservedQuote,
      };
    });

    const historyFrom = all[0]?.time ?? 0;
    const historyTo = all[all.length - 1]?.time ?? 0;
    const lo = from ?? historyFrom;
    const hi = to ?? historyTo;
    const quotes = all.filter((q) => q.time >= lo && q.time <= hi);
    return { quotes, historyFrom, historyTo };
  }

  /** Available history bounds for a config's trading market (for UI clamping). */
  async getHistoryRange(userId: string, id: string): Promise<{ historyFrom: number; historyTo: number }> {
    const mc = await this.findOne(userId, id);
    const tradingMarketId = mc.tradingMarketId ?? mc.observedMarketIds[0];
    const series = tradingMarketId ? await this.fetchNorm(tradingMarketId) : [];
    if (series.length === 0) {
      const synthetic = await this.getQuotes(userId, id, 800);
      return {
        historyFrom: synthetic[0]?.time ?? 0,
        historyTo: synthetic[synthetic.length - 1]?.time ?? 0,
      };
    }
    return { historyFrom: series[0].time, historyTo: series[series.length - 1].time };
  }

  /** Fetch a market's real data and normalise each point to bid/ask/mid. */
  private async fetchNorm(marketId: string): Promise<NormPoint[]> {
    const [sourceId, pairId] = this.splitMarketId(marketId);
    if (!sourceId || !pairId) return [];
    let data: ChartPricePoint[];
    try {
      const res = await this.prices.getPricesByMarket(sourceId, pairId);
      data = res.data;
    } catch {
      return [];
    }
    return data.map((p) => {
      const bid = typeof p.bidPrice === 'number' ? p.bidPrice : 0;
      const ask = typeof p.askPrice === 'number' ? p.askPrice : 0;
      const mid = typeof p.midPrice === 'number' ? p.midPrice : bid > 0 && ask > 0 ? (bid + ask) / 2 : bid || ask;
      return {
        time: p.time,
        bid: bid || mid,
        ask: ask || mid,
        mid: mid || bid || ask,
      };
    });
  }

  /** `${sourceId}__${pairId}` → [sourceId, pairId] (falls back to the catalog). */
  private splitMarketId(marketId: string): [string | undefined, string | undefined] {
    const idx = marketId.indexOf('__');
    if (idx > 0) return [marketId.slice(0, idx), marketId.slice(idx + 2)];
    const market = findMarket(marketId);
    return [market?.sourceId, market?.pairId];
  }

  private sliceSynthetic(synthetic: QuotePoint[], from?: number, to?: number): QuotesRangeResult {
    const historyFrom = synthetic[0]?.time ?? 0;
    const historyTo = synthetic[synthetic.length - 1]?.time ?? 0;
    const lo = from ?? historyFrom;
    const hi = to ?? historyTo;
    return { quotes: synthetic.filter((q) => q.time >= lo && q.time <= hi), historyFrom, historyTo };
  }
}
