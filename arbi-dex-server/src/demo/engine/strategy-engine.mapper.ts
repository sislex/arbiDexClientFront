/**
 * Maps a demo `StrategyConfigData` (the `StrategyConditionValue[]` shape edited
 * on the React front) onto the shared strategy engine
 * (`@sislex/arbi-conditions-libs`).
 *
 * All enabled gate conditions from the config are mapped onto `StrategyEngineConfig`
 * and evaluated via the built-in registry (+ custom avg/spread gates that mirror
 * the legacy `simulate.ts` formulas).
 */

import {
  TRIGGER_CONDITIONS,
  enabledCondition,
  noTransactionInProgressCondition,
} from '@sislex/arbi-conditions-libs';
import type { ConditionDef, StrategyEngineConfig } from '@sislex/arbi-conditions-libs';
import { lastTransactionTimeBeforeCurrent } from '@sislex/arbi-conditions-libs';
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

function buildTriggers(sell: StrategyConditionValue[]): ConditionDef[] {
  return TRIGGER_CONDITIONS.filter((def) => {
    if (def.id === 'stop_loss') return isOn(sell, 'stop_loss');
    if (def.id === 'trailing_take_profit') return isOn(sell, 'trailing_take_profit');
    if (def.id === 'max_holding_time') return isOn(sell, 'max_holding_time');
    return true;
  });
}

/**
 * Build the engine strategy + gate/trigger sets from a demo strategy.
 * Pass the returned `strategy`, `gates` (as `conditions`) and `triggers` (as
 * `triggerConditions`) straight into `runBacktest`/`processStep`.
 */
export function toEngineStrategy(
  buy: StrategyConditionValue[],
  sell: StrategyConditionValue[],
): EngineStrategyMapping {
  const buyEnabled = isOn(buy, 'enabled') && boolParam(buy, 'enabled', 'enabled', true);
  const sellEnabled = isOn(sell, 'enabled') && boolParam(sell, 'enabled', 'enabled', true);

  const buyAvgOn = isOn(buy, 'avg_observed_higher_for_last_steps');
  const sellAvgOn = isOn(sell, 'avg_observed_higher_for_last_steps');
  const buyPct = buyAvgOn
    ? numParam(buy, 'avg_observed_higher_for_last_steps', 'percent', 0.5)
    : Number.NEGATIVE_INFINITY;
  const buySteps = buyAvgOn
    ? Math.max(1, Math.round(numParam(buy, 'avg_observed_higher_for_last_steps', 'steps', 3)))
    : 1;
  const sellPct = sellAvgOn
    ? numParam(sell, 'avg_observed_higher_for_last_steps', 'percent', 0.5)
    : Number.NEGATIVE_INFINITY;
  const sellSteps = sellAvgOn
    ? Math.max(1, Math.round(numParam(sell, 'avg_observed_higher_for_last_steps', 'steps', 3)))
    : 1;

  const buySpreadOn = isOn(buy, 'spread_ok');
  const sellSpreadOn = isOn(sell, 'spread_ok');
  const buyMaxSpread = buySpreadOn
    ? numParam(buy, 'spread_ok', 'maxSpreadPercent', 100)
    : Number.POSITIVE_INFINITY;
  const sellMaxSpread = sellSpreadOn
    ? numParam(sell, 'spread_ok', 'maxSpreadPercent', 100)
    : Number.POSITIVE_INFINITY;

  const buyNoTxOn =
    isOn(buy, 'no_transaction_in_progress') &&
    boolParam(buy, 'no_transaction_in_progress', 'require', true);
  const sellNoTxOn =
    isOn(sell, 'no_transaction_in_progress') &&
    boolParam(sell, 'no_transaction_in_progress', 'require', true);

  const buyDelayOn = isOn(buy, 'transaction_delay_ok');
  const sellDelayOn = isOn(sell, 'transaction_delay_ok');
  const buyMinDelay = buyDelayOn
    ? numParam(buy, 'transaction_delay_ok', 'minDelayMs', 0)
    : 0;
  const sellMinDelay = sellDelayOn
    ? numParam(sell, 'transaction_delay_ok', 'minDelayMs', 0)
    : 0;

  const buyBalanceOn =
    isOn(buy, 'balance_ok') && boolParam(buy, 'balance_ok', 'require', true);
  const sellBalanceOn =
    isOn(sell, 'balance_ok') && boolParam(sell, 'balance_ok', 'require', true);
  const buyMinBalance = buyBalanceOn
    ? numParam(buy, 'balance_ok', 'minBalance', 0)
    : 0;
  const sellMinBalance = sellBalanceOn
    ? numParam(sell, 'balance_ok', 'minBalance', 0)
    : 0;

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
      requireNoTransactionInProgress: buyNoTxOn,
      avgObservedHigherThanBuyForLastSteps: { steps: buySteps, percent: buyPct },
      maxBuySellSpreadPercent: buyMaxSpread,
      minDelayAfterLastFinishedTransactionMs: buyMinDelay,
      requireToken1Balance: buyBalanceOn,
      minToken1Balance: buyMinBalance,
    },
    sell: {
      enabled: sellEnabled,
      requireNoTransactionInProgress: sellNoTxOn,
      avgObservedHigherThanSellForLastSteps: { steps: sellSteps, percent: sellPct },
      maxBuySellSpreadPercent: sellMaxSpread,
      minDelayAfterLastFinishedTransactionMs: sellMinDelay,
      requireToken2Balance: sellBalanceOn,
      minToken2Balance: sellMinBalance,
      stopLossPercent,
      trailingTakeProfitPercent,
      maxHoldingTimeMs,
    },
  };

  // Custom avg-deviation gate (legacy simulate.ts formula). Disabled side → neutral.
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

  // Custom spread gate (legacy simulate.ts formula). Disabled → neutral.
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

  // Buy checks quote balance (token2 / USDT); sell checks base holdings (token1).
  const balance: ConditionDef = {
    id: 'balance_ok',
    window: () => ({}),
    evaluate: (ctx, strategy, side) => {
      if (side === 'buy') {
        const require = strategy.buy.requireToken1Balance;
        const minBalance = strategy.buy.minToken1Balance;
        const bal = ctx.current.balances?.token2;
        return {
          passed: !require || (bal ?? Number.NEGATIVE_INFINITY) >= minBalance,
          actual: bal ?? '—',
          required: minBalance,
        };
      }
      const require = strategy.sell.requireToken2Balance;
      const minBalance = strategy.sell.minToken2Balance;
      const bal = ctx.current.balances?.token1;
      return {
        passed: !require || (bal ?? Number.NEGATIVE_INFINITY) >= minBalance,
        actual: bal ?? '—',
        required: minBalance,
      };
    },
  };

  // Delay since the last buy OR sell. Disabled side → neutral.
  const transactionDelay: ConditionDef = {
    id: 'transaction_delay_ok',
    window: (_s, side) => {
      const on = side === 'buy' ? buyDelayOn : sellDelayOn;
      const min = side === 'buy' ? buyMinDelay : sellMinDelay;
      if (!on || min <= 0) return {};
      return { durationMs: min, toLastTransaction: true };
    },
    evaluate: (ctx, _s, side) => {
      const on = side === 'buy' ? buyDelayOn : sellDelayOn;
      if (!on) return { passed: true };
      const minMs = side === 'buy' ? buyMinDelay : sellMinDelay;
      if (minMs <= 0) return { passed: true };
      const lastTx = lastTransactionTimeBeforeCurrent(ctx.window);
      const sinceMs = lastTx === null ? Number.POSITIVE_INFINITY : ctx.current.time - lastTx;
      return { passed: sinceMs > minMs, actual: sinceMs, required: minMs };
    },
  };

  const gates: ConditionDef[] = [
    enabledCondition,
    noTransactionInProgressCondition,
    avgDeviation,
    spread,
    transactionDelay,
    balance,
  ];

  return {
    strategy,
    gates,
    triggers: buildTriggers(sell),
  };
}
