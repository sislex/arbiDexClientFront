/**
 * Engine-based backtest runner.
 *
 * Drives the shared strategy engine (`processStep` from
 * `@sislex/arbi-conditions-libs`) over a tick series while tracking a single
 * long position, then executes buys/sells with slippage and `tradeAmountPct`.
 * This replaces the static conditions.config.json path: the actual per-config
 * strategy (auto-buy / auto-sell thresholds + stop-loss + trailing take-profit)
 * now drives the simulation.
 *
 * A `no position → transaction.buy` grows a position; a
 * `position → transaction.sell || transaction.forcedSell` closes it (the arb
 * gate OR any sell trigger). Kept close to the legacy `BacktestEngine` so the
 * two agree — see engine-backtest.parity.spec.ts.
 */

import { processStep } from '@sislex/arbi-conditions-libs';
import type { MarketStep, PositionState, TradingConditionsStepResult } from '@sislex/arbi-conditions-libs';
import type { BacktestConfig, BacktestTick, BacktestResult, BacktestTrade } from '../engine/backtest.engine';
import { buildGateConditions, buildStrategyFromConfig, buildTriggerConditions } from './strategy-config.mapper';

/** Pass/fail tally for one engine condition across the whole run. */
export interface EngineConditionStat {
  id: string;
  passedCount: number;
  failedCount: number;
}

/** A sampled "significant" step (a signal fired or a trade happened). */
export interface EngineStepAnalytics {
  time: number;
  index: number;
  quotes: { observedPrice: number; buyPrice: number; sellPrice: number };
  action: 'buy' | 'sell' | 'none';
  reason: string;
}

/** Compact analytics over the whole run. */
export interface EngineBacktestSummary {
  totalSteps: number;
  buySignals: number;
  sellSignals: number;
  forcedSells: number;
  conditionStats: EngineConditionStat[];
}

export interface EngineBacktestResult extends BacktestResult {
  summary: EngineBacktestSummary;
  steps: EngineStepAnalytics[];
  significantSteps: number;
  stepsTruncated: boolean;
}

/** Cap on the sampled `steps` payload (protects the browser from huge arrays). */
const STEP_SAMPLE_LIMIT = 2000;

const r2 = (n: number): number => parseFloat(n.toFixed(2));
const r8 = (n: number): number => parseFloat(n.toFixed(8));

/** Human-readable reason from whichever sell condition(s) fired. */
function sellReason(result: TradingConditionsStepResult): string {
  const parts: string[] = [];
  if (result.condition.sell['stop_loss']?.passed) parts.push('stop_loss');
  if (result.condition.sell['trailing_take_profit']?.passed) parts.push('trailing_take_profit');
  if (result.condition.sell['auto_sell']?.passed) parts.push('auto_sell');
  return parts.join(', ') || 'sell';
}

export function runEngineBacktest(ticks: BacktestTick[], cfg: BacktestConfig): EngineBacktestResult {
  const strategy = buildStrategyFromConfig(cfg);
  const gates = buildGateConditions(cfg);
  const triggers = buildTriggerConditions();
  const slippage = Number(cfg.slippage) || 0;
  const tradeAmountPct = Number(cfg.tradeAmountPct ?? 100);
  const initialBalance = Number(cfg.initialBalance) || 0;

  let usdcBalance = initialBalance;
  let wethBalance = 0;
  let position: PositionState | null = null;
  let lastMid = 0;

  const window: MarketStep[] = [];
  const trades: BacktestTrade[] = [];
  const steps: EngineStepAnalytics[] = [];
  let significantSteps = 0;
  let tradeCounter = 0;
  let buySignals = 0;
  let sellSignals = 0;
  let forcedSells = 0;

  const statById = new Map<string, EngineConditionStat>();
  const bump = (id: string, passed: boolean): void => {
    let s = statById.get(id);
    if (!s) {
      s = { id, passedCount: 0, failedCount: 0 };
      statById.set(id, s);
    }
    if (passed) s.passedCount += 1;
    else s.failedCount += 1;
  };

  for (const tick of ticks) {
    window.push({
      time: tick.time,
      quotes: { buyQuote: tick.tradingAsk, sellQuote: tick.tradingBid, avgObservedQuote: tick.avgRefMid },
    });

    // Track the last usable mid for portfolio valuation.
    if (tick.tradingBid > 0 && tick.tradingAsk > 0) lastMid = (tick.tradingBid + tick.tradingAsk) / 2;
    else if (tick.tradingBid > 0) lastMid = tick.tradingBid;
    else if (tick.tradingAsk > 0) lastMid = tick.tradingAsk;

    // Skip the decision on invalid ticks (mirrors BacktestEngine).
    if (tick.tradingBid <= 0 || tick.tradingAsk <= 0 || tick.avgRefMid <= 0) continue;

    const result = processStep({ steps: window, strategy, position, conditions: gates, triggerConditions: triggers });

    const buySignal = result.transaction.buy;
    const sellSignal = result.transaction.sell;
    const forced = result.transaction.forcedSell;
    if (buySignal) buySignals += 1;
    if (sellSignal) sellSignals += 1;
    if (forced) forcedSells += 1;
    bump('auto_buy', result.condition.buy['auto_buy']?.passed ?? false);
    bump('auto_sell', result.condition.sell['auto_sell']?.passed ?? false);
    bump('stop_loss', result.condition.sell['stop_loss']?.passed ?? false);
    bump('trailing_take_profit', result.condition.sell['trailing_take_profit']?.passed ?? false);

    let action: EngineStepAnalytics['action'] = 'none';
    let reason = '';

    if (position === null && buySignal && usdcBalance > 0) {
      const amountUsdc = usdcBalance * (tradeAmountPct / 100);
      if (amountUsdc > 0) {
        const price = tick.tradingAsk;
        const amountOut = amountUsdc / (price * (1 + slippage));
        usdcBalance -= amountUsdc;
        wethBalance += amountOut;
        position = { entryPrice: price, size: amountOut, openedAt: tick.time };
        action = 'buy';
        reason = 'auto_buy';
        trades.push({
          id: (tradeCounter += 1),
          step: tick.index,
          time: tick.time,
          direction: 'USDC_TO_WETH',
          amountIn: r8(amountUsdc),
          tokenIn: 'USDC',
          amountOut: r8(amountOut),
          tokenOut: 'WETH',
          price,
          slippage,
          reason,
        });
      }
    } else if (position !== null && (sellSignal || forced) && wethBalance > 0) {
      const price = tick.tradingBid;
      const amountWeth = wethBalance;
      const amountOut = amountWeth * (price * (1 - slippage));
      wethBalance = 0;
      usdcBalance += amountOut;
      position = null;
      action = 'sell';
      reason = sellReason(result);
      trades.push({
        id: (tradeCounter += 1),
        step: tick.index,
        time: tick.time,
        direction: 'WETH_TO_USDC',
        amountIn: r8(amountWeth),
        tokenIn: 'WETH',
        amountOut: r8(amountOut),
        tokenOut: 'USDC',
        price,
        slippage,
        reason,
      });
    }

    if (action !== 'none' || buySignal || sellSignal || forced) {
      significantSteps += 1;
      if (steps.length < STEP_SAMPLE_LIMIT) {
        steps.push({
          time: tick.time,
          index: tick.index,
          quotes: { observedPrice: tick.avgRefMid, buyPrice: tick.tradingAsk, sellPrice: tick.tradingBid },
          action,
          reason,
        });
      }
    }
  }

  const portfolioValue = usdcBalance + wethBalance * lastMid;
  const pnl = portfolioValue - initialBalance;
  const pnlPct = initialBalance > 0 ? (pnl / initialBalance) * 100 : 0;

  return {
    finalUsdcBalance: r8(usdcBalance),
    finalWethBalance: r8(wethBalance),
    portfolioValue: r2(portfolioValue),
    initialBalance,
    pnl: r2(pnl),
    pnlPct: parseFloat(pnlPct.toFixed(4)),
    totalTrades: trades.length,
    buyCount: trades.filter((t) => t.direction === 'USDC_TO_WETH').length,
    sellCount: trades.filter((t) => t.direction === 'WETH_TO_USDC').length,
    totalPoints: ticks.length,
    trades,
    summary: {
      totalSteps: ticks.length,
      buySignals,
      sellSignals,
      forcedSells,
      conditionStats: [...statById.values()],
    },
    steps,
    significantSteps,
    stepsTruncated: significantSteps > steps.length,
  };
}
