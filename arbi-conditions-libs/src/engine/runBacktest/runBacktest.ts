/**
 * runBacktest — drive the strategy engine over a step series while tracking a
 * single long position, executing trades and reporting P&L.
 *
 * `processStep` (the engine core) only reports WHICH conditions hold on each
 * step; it does not track a position or money. This runner is the missing
 * simulation layer shared by every backtest caller:
 *
 *   - no position + `transaction.buy`                 → open a position (spend cash);
 *   - open position + `transaction.sell || forcedSell` → close it (realise P&L).
 *
 * The sell gate (arb signal) and the sell triggers (stop-loss / trailing
 * take-profit / max-holding) both close a position — the trigger set is OR-ed
 * into `forcedSell` by the engine. An open position at the end of the series is
 * closed at the last step (`reason: 'close_at_end'`).
 *
 * Pure and framework-agnostic. Money is accounted in "cash" (quote asset) and
 * "tokens" (base asset); buys fill at `buyQuote` (ask), sells at `sellQuote`
 * (bid), each adjusted by `slippage`.
 *
 * @example
 * import { runBacktest } from '@sislex/arbi-conditions-libs';
 *
 * const result = runBacktest(steps, strategy, { initialBalance: 1000 });
 * result.stats.pnl;      // realised + unrealised P&L over the run
 * result.trades;         // every buy/sell with price, amount and reason
 */

import { CONDITIONS, TRIGGER_CONDITIONS } from '../conditions';
import { processStep } from '../processStep';
import type {
  ConditionDef,
  MarketStep,
  PositionState,
  StrategyEngineConfig,
  TradingConditionsStepResult,
} from '../types';

/** A single executed trade. */
export interface BacktestTrade {
  id: string;
  /** Index of the step the trade happened on. */
  index: number;
  time: number;
  side: 'buy' | 'sell';
  /** Fill price (quote per token), before slippage. */
  price: number;
  /** Token amount bought or sold. */
  amount: number;
  /** Realised P&L in cash for a closing (sell) trade. */
  pnl?: number;
  /** Which condition(s) drove the trade (`auto_buy`, `stop_loss`, `close_at_end`, …). */
  reason: string;
}

/** Aggregate statistics over the whole run. */
export interface BacktestStats {
  /** Total trades (buys + sells). */
  trades: number;
  /** Final equity minus initial balance. */
  pnl: number;
  /** `pnl` as a percentage of the initial balance. */
  pnlPct: number;
  /** Winning round-trips (positive P&L) as a percentage of all round-trips. */
  winRate: number;
  /** Largest peak-to-trough equity drawdown, in percent. */
  maxDrawdownPct: number;
  /** Cash-equivalent equity at the end of the run. */
  finalBalance: number;
}

/** Pass/fail tally for one condition across the whole run. */
export interface BacktestConditionStat {
  id: string;
  passedCount: number;
  failedCount: number;
}

/** Compact signal/condition analytics over the run. */
export interface BacktestSummary {
  totalSteps: number;
  buySignals: number;
  sellSignals: number;
  forcedSells: number;
  conditionStats: BacktestConditionStat[];
}

/** Full result of a backtest run. */
export interface EngineBacktestResult {
  id: string;
  /** `time` of the first step (0 when empty). */
  from: number;
  /** `time` of the last step (0 when empty). */
  to: number;
  trades: BacktestTrade[];
  stats: BacktestStats;
  summary: BacktestSummary;
}

export interface BacktestOptions {
  /** Starting cash (quote asset). Default 1000. */
  initialBalance?: number;
  /** Percent of available cash spent on each entry (0..100). Default 100. */
  tradeAmountPct?: number;
  /** Fractional slippage applied against the trader on every fill (e.g. 0.001). Default 0. */
  slippage?: number;
  /** Result id (echoed back). Default 'bt'. */
  id?: string;
  /** Gate condition set (AND-ed per side). Default the built-in `CONDITIONS`. */
  conditions?: ConditionDef[];
  /** Sell trigger set (OR-ed into forcedSell). Default the built-in `TRIGGER_CONDITIONS`. */
  triggerConditions?: ConditionDef[];
}

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Human-readable reason built from whichever sell condition(s) fired. */
function sellReason(result: TradingConditionsStepResult, triggers: ConditionDef[]): string {
  const parts: string[] = [];
  for (const def of triggers) {
    if (result.condition.sell[def.id]?.passed) parts.push(def.id);
  }
  if (result.transaction.sell) parts.push('sell');
  return parts.join(', ') || 'sell';
}

export function runBacktest(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
  opts: BacktestOptions = {},
): EngineBacktestResult {
  const initialBalance = opts.initialBalance ?? 1000;
  const tradeAmountPct = opts.tradeAmountPct ?? 100;
  const slippage = opts.slippage ?? 0;
  const conditions = opts.conditions ?? CONDITIONS;
  const triggerConditions = opts.triggerConditions ?? TRIGGER_CONDITIONS;

  let cash = initialBalance;
  let tokens = 0;
  let entryCash = 0; // cash spent opening the current position
  let position: PositionState | null = null;

  const window: MarketStep[] = [];
  const trades: BacktestTrade[] = [];
  let tradeCounter = 0;
  let wins = 0;

  let equityPeak = initialBalance;
  let maxDrawdown = 0;
  let buySignals = 0;
  let sellSignals = 0;
  let forcedSells = 0;

  const statById = new Map<string, BacktestConditionStat>();
  const bump = (id: string, passed: boolean): void => {
    let s = statById.get(id);
    if (!s) {
      s = { id, passedCount: 0, failedCount: 0 };
      statById.set(id, s);
    }
    if (passed) s.passedCount += 1;
    else s.failedCount += 1;
  };

  for (const [index, step] of steps.entries()) {
    window.push(step);
    const { buyQuote, sellQuote } = step.quotes;

    // Mark-to-market equity for the drawdown curve (tokens valued at the bid).
    const equity = cash + tokens * sellQuote;
    if (equity > equityPeak) equityPeak = equity;
    if (equityPeak > 0) {
      const dd = ((equityPeak - equity) / equityPeak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const result = processStep({ steps: window, strategy, position, conditions, triggerConditions });
    if (result.transaction.buy) buySignals += 1;
    if (result.transaction.sell) sellSignals += 1;
    if (result.transaction.forcedSell) forcedSells += 1;
    for (const def of conditions) bump(def.id, result.condition.buy[def.id]?.passed ?? false);
    for (const def of triggerConditions) bump(def.id, result.condition.sell[def.id]?.passed ?? false);

    if (position === null) {
      if (result.transaction.buy && cash > 0) {
        const spend = cash * (tradeAmountPct / 100);
        const fill = buyQuote * (1 + slippage);
        if (spend > 0 && fill > 0) {
          const amount = spend / fill;
          cash -= spend;
          tokens += amount;
          entryCash = spend;
          position = { entryPrice: buyQuote, size: amount, openedAt: step.time };
          trades.push({
            id: `t${tradeCounter++}`,
            index,
            time: step.time,
            side: 'buy',
            price: buyQuote,
            amount,
            reason: 'auto_buy',
          });
        }
      }
    } else if (result.transaction.sell || result.transaction.forcedSell) {
      const fill = sellQuote * (1 - slippage);
      const proceeds = tokens * fill;
      const pnl = proceeds - entryCash;
      if (pnl > 0) wins += 1;
      trades.push({
        id: `t${tradeCounter++}`,
        index,
        time: step.time,
        side: 'sell',
        price: sellQuote,
        amount: tokens,
        pnl: round(pnl),
        reason: sellReason(result, triggerConditions),
      });
      cash += proceeds;
      tokens = 0;
      entryCash = 0;
      position = null;
    }
  }

  // Force-close any open position at the last step.
  const last = steps[steps.length - 1];
  if (tokens > 0 && last) {
    const fill = last.quotes.sellQuote * (1 - slippage);
    const proceeds = tokens * fill;
    const pnl = proceeds - entryCash;
    if (pnl > 0) wins += 1;
    trades.push({
      id: `t${tradeCounter++}`,
      index: steps.length - 1,
      time: last.time,
      side: 'sell',
      price: last.quotes.sellQuote,
      amount: tokens,
      pnl: round(pnl),
      reason: 'close_at_end',
    });
    cash += proceeds;
    tokens = 0;
  }

  const finalBalance = cash;
  const roundTrips = trades.filter((t) => t.side === 'sell').length;

  return {
    id: opts.id ?? 'bt',
    from: steps[0]?.time ?? 0,
    to: steps[steps.length - 1]?.time ?? 0,
    trades,
    stats: {
      trades: trades.length,
      pnl: round(finalBalance - initialBalance),
      pnlPct: round(((finalBalance - initialBalance) / initialBalance) * 100),
      winRate: roundTrips ? round((wins / roundTrips) * 100) : 0,
      maxDrawdownPct: round(maxDrawdown),
      finalBalance: round(finalBalance),
    },
    summary: {
      totalSteps: steps.length,
      buySignals,
      sellSignals,
      forcedSells,
      conditionStats: [...statById.values()],
    },
  };
}
