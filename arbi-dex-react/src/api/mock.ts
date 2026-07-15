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
    historyRange: (id: string) => {
      const full = series({ marketConfigId: id, count: 800 });
      return delay({ historyFrom: full[0]?.time ?? 0, historyTo: full[full.length - 1]?.time ?? 0 });
    },
    followAnalysis: (id: string, params: { movePct?: number; window?: number; from?: number; to?: number } = {}) => {
      const startedAt = Date.now();
      const mc = db.marketConfigs.find((m) => m.id === id);
      const observedIds = mc ? mc.observedMarketIds.filter((m) => m !== mc.tradingMarketId) : [];
      if (observedIds.length === 0) {
        return Promise.reject(
          new Error('Нет наблюдаемых рынков — анализ следования невозможен. Добавьте хотя бы один наблюдаемый рынок.'),
        );
      }
      const full = series({ marketConfigId: id, count: 800 });
      const lo = params.from ?? full[0]?.time ?? 0;
      const hi = params.to ?? full[full.length - 1]?.time ?? 0;
      const quotes = full.filter((q) => q.time >= lo && q.time <= hi);
      const movePct = params.movePct && params.movePct > 0 ? params.movePct : 0.05;
      const windowSteps = Math.max(1, Math.round(params.window ?? 5));

      // Same algorithm as the live backend (see MarketConfigsService.followAnalysis).
      const mid = (q: QuotePoint): number => (q.buyQuote + q.sellQuote) / 2;
      const stats = { up: { events: 0, followed: 0 }, down: { events: 0, followed: 0 } };
      let lagStepsSum = 0;
      let lagTimeSum = 0;
      const eventList: import('./types').FollowEvent[] = [];
      for (let t = 1; t < quotes.length; t++) {
        const prevObs = quotes[t - 1].avgObservedQuote;
        const curObs = quotes[t].avgObservedQuote;
        const base = mid(quotes[t - 1]);
        if (!(prevObs > 0) || !(curObs > 0) || !(base > 0)) continue;
        const movedPct = ((curObs - prevObs) / prevObs) * 100;
        if (Math.abs(movedPct) < movePct) continue;
        const dir = movedPct > 0 ? 1 : -1;
        const bucket = dir > 0 ? stats.up : stats.down;
        bucket.events += 1;
        let followedAt = -1;
        const last = Math.min(t + windowSteps, quotes.length - 1);
        for (let j = t; j <= last; j++) {
          const chgPct = ((mid(quotes[j]) - base) / base) * 100;
          if (dir > 0 ? chgPct >= movePct : chgPct <= -movePct) {
            followedAt = j;
            break;
          }
        }
        if (followedAt >= 0) {
          bucket.followed += 1;
          lagStepsSum += followedAt - t;
          lagTimeSum += quotes[followedAt].time - quotes[t].time;
        }
        eventList.push({
          time: quotes[t].time,
          direction: dir > 0 ? 'up' : 'down',
          movedPct: +movedPct.toFixed(4),
          followed: followedAt >= 0,
          followedAt: followedAt >= 0 ? quotes[followedAt].time : null,
          lagSteps: followedAt >= 0 ? followedAt - t : null,
        });
      }
      const events = stats.up.events + stats.down.events;
      const followed = stats.up.followed + stats.down.followed;
      const rate = (f: number, e: number): number => (e > 0 ? +((f / e) * 100).toFixed(1) : 0);
      return delay({
        totalSteps: quotes.length,
        events,
        followed,
        followRate: rate(followed, events),
        up: { ...stats.up, followRate: rate(stats.up.followed, stats.up.events) },
        down: { ...stats.down, followRate: rate(stats.down.followed, stats.down.events) },
        avgLagSteps: followed > 0 ? +(lagStepsSum / followed).toFixed(1) : null,
        avgLagMs: followed > 0 ? Math.round((lagTimeSum / followed) * 1000) : null,
        eventList,
        movePct,
        windowSteps,
        from: lo,
        to: hi,
        historyFrom: full[0]?.time ?? 0,
        historyTo: full[full.length - 1]?.time ?? 0,
        tookMs: Date.now() - startedAt,
      });
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
