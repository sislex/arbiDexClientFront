import type { Bot, Market, MarketConfig, QuotePoint, StrategyConfig, User } from '../domain/types';
import { MARKETS, NOW, PAIR_BASE_PRICE } from '../mocks/seed';
import { generateQuoteSeries } from '../mocks/quotes';
import { simulateBacktest } from '../mocks/simulate';
import { runAutotune } from '../mocks/autotune';
import { db, nextId } from './db';
import { buildPreview } from '../features/marketConfigs/preview';
import type { ApiClient, QuotesParams } from './types';

/** Simulated network latency. Set to 0 in tests via `setApiDelay`. */
let DELAY = 140;
export function setApiDelay(ms: number) {
  DELAY = ms;
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), DELAY));
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function marketById(id: string): Market | undefined {
  return MARKETS.find((m) => m.id === id);
}

function pairForConfig(mc: MarketConfig): string {
  return marketById(mc.tradingMarketId)?.pairId ?? 'ETH_USDT';
}

function series(params: QuotesParams): QuotePoint[] {
  const count = params.count ?? 240;
  const intervalSec = params.intervalSec ?? 60;
  const endTime = params.endTime ?? NOW;
  let pairId = params.pairId ?? 'ETH_USDT';
  let seed = params.seed ?? pairId;
  if (params.marketConfigId) {
    const mc = db.marketConfigs.find((m) => m.id === params.marketConfigId);
    if (mc) {
      pairId = pairForConfig(mc);
      seed = params.seed ?? mc.id;
    }
  }
  const basePrice = PAIR_BASE_PRICE[pairId] ?? 3200;
  return generateQuoteSeries({ seed, count, intervalSec, endTime, basePrice });
}

export const mockApi: ApiClient = {
  auth: {
    // Mock ignores the wallet method — no real provider in mock mode.
    async connectWallet(): Promise<User> {
      const addr = '0x' + 'A1b2C3d4E5f6'.repeat(3).slice(0, 40);
      return delay({ address: addr, token: 'mock-jwt-' + addr.slice(2, 10), isNew: true });
    },
  },

  catalog: {
    markets(): Promise<Market[]> {
      return delay(clone(MARKETS));
    },
  },

  bots: {
    list: () => delay(clone(db.bots)),
    get: (id: string) => delay(clone(db.bots.find((b) => b.id === id))),
    create: (input: Omit<Bot, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date(NOW * 1000).toISOString();
      const bot: Bot = { ...input, id: nextId('bot'), createdAt: now, updatedAt: now };
      db.bots.unshift(bot);
      return delay(clone(bot));
    },
    update: (id: string, patch: Partial<Bot>) => {
      const bot = db.bots.find((b) => b.id === id);
      if (!bot) throw new Error(`bot ${id} not found`);
      Object.assign(bot, patch, { updatedAt: new Date(NOW * 1000).toISOString() });
      return delay(clone(bot));
    },
    remove: (id: string) => {
      db.bots = db.bots.filter((b) => b.id !== id);
      return delay(undefined);
    },
    historyRange: (id: string) => {
      const bot = db.bots.find((b) => b.id === id);
      const full = series({ marketConfigId: bot?.marketConfigId, count: 800 });
      return delay({
        historyFrom: full[0]?.time ?? 0,
        historyTo: full[full.length - 1]?.time ?? 0,
      });
    },
    quotes: (id: string, params: { from?: number; to?: number } = {}) => {
      const bot = db.bots.find((b) => b.id === id);
      const full = series({ marketConfigId: bot?.marketConfigId, count: 800 });
      const lo = params.from ?? full[0]?.time ?? 0;
      const hi = params.to ?? full[full.length - 1]?.time ?? 0;
      return delay({ quotes: full.filter((q) => q.time >= lo && q.time <= hi) });
    },
    stepResult: () =>
      Promise.reject(new Error('Разбор шага доступен только в live-режиме (нужен движок стратегий на сервере)')),
  },

  marketConfigs: {
    list: () => delay(clone(db.marketConfigs)),
    get: (id: string) => delay(clone(db.marketConfigs.find((m) => m.id === id))),
    create: (input: Omit<MarketConfig, 'id' | 'createdAt'>) => {
      const mc: MarketConfig = { ...input, id: nextId('mc'), createdAt: new Date(NOW * 1000).toISOString() };
      db.marketConfigs.unshift(mc);
      return delay(clone(mc));
    },
    update: (id: string, patch: Partial<MarketConfig>) => {
      const mc = db.marketConfigs.find((m) => m.id === id);
      if (!mc) throw new Error(`market config ${id} not found`);
      Object.assign(mc, patch);
      return delay(clone(mc));
    },
    remove: (id: string) => {
      db.marketConfigs = db.marketConfigs.filter((m) => m.id !== id);
      return delay(undefined);
    },
  },

  strategyConfigs: {
    list: () => delay(clone(db.strategyConfigs)),
    get: (id: string) => delay(clone(db.strategyConfigs.find((s) => s.id === id))),
    create: (input: Omit<StrategyConfig, 'id' | 'createdAt'>) => {
      const s: StrategyConfig = { ...input, id: nextId('st'), createdAt: new Date(NOW * 1000).toISOString() };
      db.strategyConfigs.unshift(s);
      return delay(clone(s));
    },
    update: (id: string, patch: Partial<StrategyConfig>) => {
      const s = db.strategyConfigs.find((x) => x.id === id);
      if (!s) throw new Error(`strategy config ${id} not found`);
      Object.assign(s, patch);
      return delay(clone(s));
    },
    remove: (id: string) => {
      db.strategyConfigs = db.strategyConfigs.filter((s) => s.id !== id);
      return delay(undefined);
    },
  },

  quotes: {
    series: (params) => delay(series(params)),
    marketPreview: (params) =>
      delay(buildPreview(MARKETS, params.tradingMarketId ?? null, params.observedMarketIds, params.weights, 'historical')),
  },

  backtest: {
    run: (params) => {
      const strategy = db.strategyConfigs.find((s) => s.id === params.strategyConfigId);
      if (!strategy) throw new Error('strategy not found');
      const full = series({ marketConfigId: params.marketConfigId, count: 800 });
      const lo = params.from ?? full[0]?.time ?? 0;
      const hi = params.to ?? full[full.length - 1]?.time ?? 0;
      const quotes = full.filter((q) => q.time >= lo && q.time <= hi);
      const result = simulateBacktest(quotes, strategy, { initialBalance: params.initialBalance, id: nextId('bt') });
      return delay({ ...result, from: lo, to: hi });
    },
  },

  autotune: {
    run: (params) => {
      const strategy = db.strategyConfigs.find((s) => s.id === params.strategyConfigId);
      if (!strategy) throw new Error('strategy not found');
      const full = series({ marketConfigId: params.marketConfigId, count: 800 });
      const lo = params.from ?? full[0]?.time ?? 0;
      const hi = params.to ?? full[full.length - 1]?.time ?? 0;
      const quotes = full.filter((q) => q.time >= lo && q.time <= hi);
      const result = runAutotune(quotes, strategy, {
        maxCombos: params.maxCombos ?? 48,
        id: nextId('at'),
      });
      return delay(result);
    },
  },
};
