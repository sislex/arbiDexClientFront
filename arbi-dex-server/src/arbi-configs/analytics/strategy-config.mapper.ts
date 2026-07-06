/**
 * Maps an ArbiConfig's autotrading fields to the shared strategy engine
 * (`@sislex/arbi-conditions-libs`).
 *
 * The engine's built-in "avg observed higher for last steps" gate uses the QUOTE
 * as its base, whereas the server strategy compares against the reference AVG:
 *   - buy  when ask ≤ avgRefMid·(1 − autoBuyThresholdPct/100)
 *   - sell when bid ≥ avgRefMid·(1 + autoSellThresholdPct/100)
 * so we supply CUSTOM gate conditions closing over the thresholds. The stop-loss
 * and trailing take-profit TRIGGERS map onto the engine's built-ins via
 * `sell.stopLossPercent` / `sell.trailingTakeProfitPercent`.
 */

import { TRIGGER_CONDITIONS } from '@sislex/arbi-conditions-libs';
import type { ConditionDef, StrategyEngineConfig } from '@sislex/arbi-conditions-libs';

/** Autotrading parameters taken from the ArbiConfig entity. */
export interface StrategyConfigInput {
  autoBuyThresholdPct: number | null;
  autoSellThresholdPct: number | null;
  trailingTakeProfitPct: number | null;
  stopLossPct: number | null;
}

/** Coerce a possibly-string (TypeORM decimal) / null value to number | null. */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A "permissive" base strategy: the engine's built-in gates (spread, balance,
 * tx-in-progress, delay, avg) never block. The real buy/sell logic lives in the
 * custom gate conditions; only the trigger fields are meaningful here.
 */
export function buildStrategyFromConfig(cfg: StrategyConfigInput): StrategyEngineConfig {
  return {
    buy: {
      enabled: true,
      requireNoTransactionInProgress: false,
      avgObservedHigherThanBuyForLastSteps: { steps: 1, percent: 0 },
      maxBuySellSpreadPercent: Number.POSITIVE_INFINITY,
      minDelayAfterLastFinishedTransactionMs: 0,
      requireToken1Balance: false,
      minToken1Balance: 0,
    },
    sell: {
      enabled: true,
      requireNoTransactionInProgress: false,
      avgObservedHigherThanSellForLastSteps: { steps: 1, percent: 0 },
      maxBuySellSpreadPercent: Number.POSITIVE_INFINITY,
      minDelayAfterLastFinishedTransactionMs: 0,
      requireToken2Balance: false,
      minToken2Balance: 0,
      stopLossPercent: num(cfg.stopLossPct),
      trailingTakeProfitPercent: num(cfg.trailingTakeProfitPct),
      maxHoldingTimeMs: null,
    },
  };
}

/**
 * Custom GATE conditions matching the server strategy exactly:
 *   auto_buy:  ask ≤ avg·(1 − autoBuyThresholdPct/100)   (buy side; neutral on sell)
 *   auto_sell: bid ≥ avg·(1 + autoSellThresholdPct/100)  (sell side; neutral on buy)
 * A null threshold disables that side's arb signal (the trigger conditions can
 * still force a sell).
 */
export function buildGateConditions(cfg: StrategyConfigInput): ConditionDef[] {
  const buyPct = num(cfg.autoBuyThresholdPct);
  const sellPct = num(cfg.autoSellThresholdPct);

  const autoBuy: ConditionDef = {
    id: 'auto_buy',
    window: () => ({}),
    evaluate: (ctx, _s, side) => {
      if (side !== 'buy') return { passed: true }; // neutral on sell
      if (buyPct === null) return { passed: false };
      const avg = ctx.current.quotes.avgObservedQuote;
      const ask = ctx.current.quotes.buyQuote;
      const buyLevel = avg * (1 - buyPct / 100);
      return { passed: avg > 0 && ask > 0 && ask <= buyLevel, actual: ask, required: buyLevel };
    },
  };

  const autoSell: ConditionDef = {
    id: 'auto_sell',
    window: () => ({}),
    evaluate: (ctx, _s, side) => {
      if (side !== 'sell') return { passed: true }; // neutral on buy
      if (sellPct === null) return { passed: false };
      const avg = ctx.current.quotes.avgObservedQuote;
      const bid = ctx.current.quotes.sellQuote;
      const sellLevel = avg * (1 + sellPct / 100);
      return { passed: avg > 0 && bid > 0 && bid >= sellLevel, actual: bid, required: sellLevel };
    },
  };

  return [autoBuy, autoSell];
}

/** Sell trigger conditions (built-in stop-loss / trailing / max-holding). */
export function buildTriggerConditions(): ConditionDef[] {
  return TRIGGER_CONDITIONS;
}
