import type { Bot, MarketConfig, StrategyConfig } from '../domain/types';
import { BOTS, MARKET_CONFIGS, STRATEGY_CONFIGS } from '../mocks/seed';

/** Mutable in-memory mock database, seeded from static fixtures. Each call to
 * `resetDb` returns a fresh deep clone so stories/tests are isolated. */
export interface MockDb {
  bots: Bot[];
  marketConfigs: MarketConfig[];
  strategyConfigs: StrategyConfig[];
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function seedDb(): MockDb {
  return {
    bots: clone(BOTS),
    marketConfigs: clone(MARKET_CONFIGS),
    strategyConfigs: clone(STRATEGY_CONFIGS),
  };
}

export const db: MockDb = seedDb();

export function resetDb() {
  const fresh = seedDb();
  db.bots = fresh.bots;
  db.marketConfigs = fresh.marketConfigs;
  db.strategyConfigs = fresh.strategyConfigs;
}

let counter = 1000;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}
