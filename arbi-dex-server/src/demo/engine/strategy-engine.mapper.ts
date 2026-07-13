/**
 * Maps a demo `StrategyConfigData` (the `StrategyConditionValue[]` shape edited
 * on the new React front) onto the shared strategy engine
 * (`@sislex/arbi-conditions-libs`).
 *
 * The demo simulator (`simulate.ts`) only ever acted on three things: the
 * avg-deviation streak, the spread cap and the sell triggers (stop-loss /
 * trailing take-profit / max holding). To keep the bot backtest behaviourally
 * identical while running it through the real engine, we supply CUSTOM gate
 * conditions that reproduce that logic and neutralise the built-in gates we do
 * not model (balance / delay / no-transaction). The three triggers map onto the
 * engine's built-ins via `sell.stopLossPercent` / `trailingTakeProfitPercent` /
 * `maxHoldingTimeMs`.
 *
 *   buy  signal: (avg − ask)/avg·100 ≥ percent for the last N steps  (+ spread ok)
 *   sell signal: (bid − avg)/avg·100 ≥ percent for the last M steps  (+ spread ok)
 */

import { enabledCondition, TRIGGER_CONDITIONS } from '@sislex/arbi-conditions-libs';
import type { ConditionDef, StrategyEngineConfig } from '@sislex/arbi-conditions-libs';
import { StrategyConditionValue } from './types';

/** Is the condition present AND enabled on this side? */
function isOn(side: StrategyConditionValue[], conditionId: string): boolean {
  const c = side.find((x) => x.conditionId === conditionId);
  return !!c && c.enabled;
}

/** Numeric param of a condition, or `fallback` when the condition is off/missing. */
function numParam(
  side: StrategyConditionValue[],
  conditionId: string,
  key: string,
  fallback: number,
): number {
  const c = side.find((x) => x.conditionId === conditionId);
  if (!c || !c.enabled) return fallback;
  const v = c.params[key];
  return typeof v === 'number' ? v : fallback;
}

/** Boolean param of a condition, or `fallback` when off/missing. */
function boolParam(
  side: StrategyConditionValue[],
  conditionId: string,
  key: string,
  fallback: boolean,
): boolean {
  const c = side.find((x) => x.conditionId === conditionId);
  if (!c || !c.enabled) return fallback;
  const v = c.params[key];
  return typeof v === 'boolean' ? v : fallback;
}

export interface EngineStrategyMapping {
  strategy: StrategyEngineConfig;
  gates: ConditionDef[];
  triggers: ConditionDef[];
}

/**
 * Build the engine strategy + custom gate/trigger sets from a demo strategy.
 * Pass the returned `strategy`, `gates` (as `conditions`) and `triggers` (as
 * `triggerConditions`) straight into `runBacktest`/`processStep`.
 */
export function toEngineStrategy(
  buy: StrategyConditionValue[],
  sell: StrategyConditionValue[],
): EngineStrategyMapping {
  // Side is tradable when the `enabled` gate is present, enabled and true.
  const buyEnabled = isOn(buy, 'enabled') && boolParam(buy, 'enabled', 'enabled', true);
  const sellEnabled = isOn(sell, 'enabled') && boolParam(sell, 'enabled', 'enabled', true);

  // Avg-deviation streak params (per side).
  const buyPct = numParam(buy, 'avg_observed_higher_for_last_steps', 'percent', 0.5);
  const buySteps = Math.max(1, Math.round(numParam(buy, 'avg_observed_higher_for_last_steps', 'steps', 3)));
  const sellPct = numParam(sell, 'avg_observed_higher_for_last_steps', 'percent', 0.5);
  const sellSteps = Math.max(1, Math.round(numParam(sell, 'avg_observed_higher_for_last_steps', 'steps', 3)));
  const buyAvgOn = isOn(buy, 'avg_observed_higher_for_last_steps');
  const sellAvgOn = isOn(sell, 'avg_observed_higher_for_last_steps');

  // Spread cap (per side, from the side's own `spread_ok`).
  const buySpreadOn = isOn(buy, 'spread_ok');
  const sellSpreadOn = isOn(sell, 'spread_ok');
  const buyMaxSpread = numParam(buy, 'spread_ok', 'maxSpreadPercent', 100);
  const sellMaxSpread = numParam(sell, 'spread_ok', 'maxSpreadPercent', 100);

  // Sell triggers.
  const stopLossPercent = isOn(sell, 'stop_loss')
    ? numParam(sell, 'stop_loss', 'stopLossPercent', 0)
    : null;
  const trailingTakeProfitPercent = isOn(sell, 'trailing_take_profit')
    ? numParam(sell, 'trailing_take_profit', 'trailingTakeProfitPercent', 0)
    : null;
  const maxHoldingTimeMs = isOn(sell, 'max_holding_time')
    ? numParam(sell, 'max_holding_time', 'maxHoldingTimeMs', 0)
    : null;

  const strategy: StrategyEngineConfig = {
    buy: {
      enabled: buyEnabled,
      requireNoTransactionInProgress: false,
      avgObservedHigherThanBuyForLastSteps: { steps: buySteps, percent: buyPct },
      maxBuySellSpreadPercent: Number.POSITIVE_INFINITY,
      minDelayAfterLastFinishedTransactionMs: 0,
      requireToken1Balance: false,
      minToken1Balance: 0,
    },
    sell: {
      enabled: sellEnabled,
      requireNoTransactionInProgress: false,
      avgObservedHigherThanSellForLastSteps: { steps: sellSteps, percent: sellPct },
      maxBuySellSpreadPercent: Number.POSITIVE_INFINITY,
      minDelayAfterLastFinishedTransactionMs: 0,
      requireToken2Balance: false,
      minToken2Balance: 0,
      stopLossPercent,
      trailingTakeProfitPercent,
      maxHoldingTimeMs,
    },
  };

  // Custom avg-deviation gate: buy when the ask sits `percent`% below the
  // observed avg for the last N steps; sell when the bid sits `percent`% above
  // it. Disabled side → neutral (passes). Mirrors `simulate.ts`.
  const avgDeviation: ConditionDef = {
    id: 'avg_observed_higher_for_last_steps',
    window: () => ({ steps: Math.max(buySteps, sellSteps) }),
    evaluate: (ctx, _s, side) => {
      const on = side === 'buy' ? buyAvgOn : sellAvgOn;
      if (!on) return { passed: true };
      const n = side === 'buy' ? buySteps : sellSteps;
      const pct = side === 'buy' ? buyPct : sellPct;
      const last = ctx.window.slice(-n);
      if (last.length < n) return { passed: false, required: pct };
      const devs = last.map((s) => {
        const { buyQuote, sellQuote, avgObservedQuote } = s.quotes;
        if (avgObservedQuote <= 0) return Number.NEGATIVE_INFINITY;
        return side === 'buy'
          ? ((avgObservedQuote - buyQuote) / avgObservedQuote) * 100
          : ((sellQuote - avgObservedQuote) / avgObservedQuote) * 100;
      });
      const weakest = Math.min(...devs);
      return { passed: devs.every((d) => d >= pct), actual: weakest, required: pct };
    },
  };

  // Custom spread gate: (ask − bid)/avg·100 ≤ maxSpread. Disabled → neutral.
  const spread: ConditionDef = {
    id: 'spread_ok',
    window: () => ({}),
    evaluate: (ctx, _s, side) => {
      const on = side === 'buy' ? buySpreadOn : sellSpreadOn;
      if (!on) return { passed: true };
      const max = side === 'buy' ? buyMaxSpread : sellMaxSpread;
      const { buyQuote, sellQuote, avgObservedQuote } = ctx.current.quotes;
      const spreadPct = avgObservedQuote > 0 ? ((buyQuote - sellQuote) / avgObservedQuote) * 100 : 0;
      return { passed: spreadPct <= max, actual: spreadPct, required: max };
    },
  };

  return {
    strategy,
    gates: [enabledCondition, avgDeviation, spread],
    triggers: TRIGGER_CONDITIONS,
  };
}
