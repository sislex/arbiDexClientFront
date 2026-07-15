import type { Bot, MarketConfig, StrategyConfig } from '../domain/types';
import type { ApiClient, MarketPreview, MarketPreviewParams, PreviewSeries } from './types';
import { request } from './http';
import { connectWalletLive } from './auth';
import { assembleMarketPreview, type TradingPoint } from './assemble';

interface PriceSeriesResponse {
  series: { key: string; name: string; color: string }[];
  data: Array<{ time: number; midPrice?: number; bidPrice?: number; askPrice?: number }>;
}

/** Market id is `${sourceId}__${pairId}`; sourceId may contain ':'. */
export function splitMarketId(id: string): { sourceId: string; pairId: string } {
  const i = id.indexOf('__');
  return { sourceId: id.slice(0, i), pairId: id.slice(i + 2) };
}

export function marketLabelFromId(id: string): string {
  const { sourceId, pairId } = splitMarketId(id);
  return `${sourceId} · ${pairId.replace('_', '/')}`;
}

function fetchMarketPrices(id: string): Promise<PriceSeriesResponse> {
  const { sourceId, pairId } = splitMarketId(id);
  return request<PriceSeriesResponse>('/prices/market', { query: { sourceId, pairId } });
}

/** Deduped, seconds-based {time,value} series from a price response's mid (or bid/ask mid). */
function toValueSeries(resp: PriceSeriesResponse): { time: number; value: number }[] {
  const byTime = new Map<number, number>();
  for (const p of resp.data) {
    const value =
      p.midPrice ??
      (p.bidPrice != null && p.askPrice != null ? (p.bidPrice + p.askPrice) / 2 : p.bidPrice ?? p.askPrice);
    if (value == null || !Number.isFinite(value)) continue;
    byTime.set(Math.floor(p.time / 1000), value);
  }
  return [...byTime.entries()].map(([time, value]) => ({ time, value })).sort((a, b) => a.time - b.time);
}

async function buildLivePreview(params: MarketPreviewParams): Promise<MarketPreview> {
  // Observed reference markets → per-market lines.
  const observedResponses = await Promise.all(
    params.observedMarketIds.map(async (id) => ({ id, resp: await fetchMarketPrices(id).catch(() => null) })),
  );
  const observed: PreviewSeries[] = observedResponses
    .filter((o) => o.resp)
    .map((o) => ({ id: o.id, label: marketLabelFromId(o.id), data: toValueSeries(o.resp!) }))
    .filter((s) => s.data.length > 0);

  // Trading market → buy(ask)/sell(bid) line.
  let tradingBidAsk: TradingPoint[] = [];
  if (params.tradingMarketId) {
    const resp = await fetchMarketPrices(params.tradingMarketId).catch(() => null);
    if (resp) {
      const byTime = new Map<number, { bid: number; ask: number }>();
      for (const p of resp.data) {
        const bid = p.bidPrice ?? p.midPrice;
        const ask = p.askPrice ?? p.midPrice;
        if (bid == null || ask == null) continue;
        byTime.set(Math.floor(p.time / 1000), { bid, ask });
      }
      tradingBidAsk = [...byTime.entries()].map(([time, v]) => ({ time, ...v })).sort((a, b) => a.time - b.time);
    }
  }

  return assembleMarketPreview(observed, tradingBidAsk, params.weights);
}

/** Normalize a market config coming from the server (null trading market → ''). */
function mapMarketConfig(mc: MarketConfig & { tradingMarketId: string | null }): MarketConfig {
  return { ...mc, tradingMarketId: mc.tradingMarketId ?? '' };
}

/** Live API client talking to arbi-dex-server. Response shapes match the
 * frontend domain types (the backend was extended to mirror them). */
export const liveApi: ApiClient = {
  auth: {
    connectWallet(method) {
      return connectWalletLive(method);
    },
  },

  catalog: {
    markets() {
      return request('/catalog/markets');
    },
  },

  bots: {
    list() {
      return request<Bot[]>('/bots');
    },
    async get(id) {
      try {
        return await request<Bot>(`/bots/${id}`);
      } catch {
        return undefined;
      }
    },
    create(input) {
      return request<Bot>('/bots', {
        method: 'POST',
        body: {
          name: input.name,
          mode: input.mode,
          status: input.status,
          marketConfigId: input.marketConfigId,
          strategyConfigId: input.strategyConfigId,
          baseAsset: input.baseAsset,
          quoteAsset: input.quoteAsset,
          initialBalance: input.initialBalance,
        },
      });
    },
    update(id, patch) {
      return request<Bot>(`/bots/${id}`, { method: 'PATCH', body: patch });
    },
    remove(id) {
      return request<void>(`/bots/${id}`, { method: 'DELETE' });
    },
    historyRange(id) {
      return request<{ historyFrom: number; historyTo: number }>(`/bots/${id}/history-range`);
    },
    quotes(id, params = {}) {
      return request(`/bots/${id}/quotes`, { query: { from: params.from, to: params.to } });
    },
    stepResult(id, params) {
      return request(`/bots/${id}/step-result`, { query: { time: params.time } });
    },
  },

  marketConfigs: {
    async list() {
      const list = await request<(MarketConfig & { tradingMarketId: string | null })[]>('/market-configs');
      return list.map(mapMarketConfig);
    },
    async get(id) {
      try {
        const mc = await request<MarketConfig & { tradingMarketId: string | null }>(`/market-configs/${id}`);
        return mapMarketConfig(mc);
      } catch {
        return undefined;
      }
    },
    async create(input) {
      const mc = await request<MarketConfig & { tradingMarketId: string | null }>('/market-configs', {
        method: 'POST',
        body: {
          name: input.name,
          tradingMarketId: input.tradingMarketId || null,
          observedMarketIds: input.observedMarketIds,
          useWeightedAverage: input.useWeightedAverage,
          weights: input.weights,
        },
      });
      return mapMarketConfig(mc);
    },
    async update(id, patch) {
      const mc = await request<MarketConfig & { tradingMarketId: string | null }>(`/market-configs/${id}`, {
        method: 'PATCH',
        body: patch,
      });
      return mapMarketConfig(mc);
    },
    remove(id) {
      return request<void>(`/market-configs/${id}`, { method: 'DELETE' });
    },
    historyRange(id) {
      return request<{ historyFrom: number; historyTo: number }>(`/market-configs/${id}/history-range`);
    },
    followAnalysis(id, params = {}) {
      return request(`/market-configs/${id}/follow-analysis`, {
        query: { movePct: params.movePct, window: params.window, from: params.from, to: params.to },
      });
    },
  },

  strategyConfigs: {
    list() {
      return request<StrategyConfig[]>('/strategy-configs');
    },
    async get(id) {
      try {
        return await request<StrategyConfig>(`/strategy-configs/${id}`);
      } catch {
        return undefined;
      }
    },
    create(input) {
      return request<StrategyConfig>('/strategy-configs', {
        method: 'POST',
        body: { name: input.name, buy: input.buy, sell: input.sell },
      });
    },
    update(id, patch) {
      return request<StrategyConfig>(`/strategy-configs/${id}`, { method: 'PATCH', body: patch });
    },
    remove(id) {
      return request<void>(`/strategy-configs/${id}`, { method: 'DELETE' });
    },
  },

  quotes: {
    series(params) {
      if (!params.marketConfigId) return Promise.resolve([]);
      return request(`/market-configs/${params.marketConfigId}/quotes`, {
        query: { count: params.count, intervalSec: params.intervalSec },
      });
    },
    marketPreview(params) {
      return buildLivePreview(params);
    },
  },

  backtest: {
    run(params) {
      if (!params.botId) {
        return Promise.reject(new Error('live backtest requires botId'));
      }
      return request(`/bots/${params.botId}/backtest`, {
        method: 'POST',
        query: { from: params.from, to: params.to },
      });
    },
  },

  autotune: {
    run(params) {
      if (!params.botId) {
        return Promise.reject(new Error('live autotune requires botId'));
      }
      return request(`/bots/${params.botId}/autotune`, {
        method: 'POST',
        query: { from: params.from, to: params.to, maxCombos: params.maxCombos },
      });
    },
  },
};
