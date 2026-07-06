/**
 * Parity: the engine-based backtest (`runEngineBacktest`) must agree with the
 * legacy `BacktestEngine` on the same synthetic series — same trade directions,
 * steps, prices and amounts, and the same PnL.
 *
 * Documented divergences (do NOT assert on these):
 * - trade `reason`: BacktestEngine reports the FIRST matching sell rule; the
 *   engine reports ALL sell conditions that fired that step.
 * - analytics fields (summary/steps) exist only on the engine result.
 */

import { BacktestEngine, BacktestConfig, BacktestTick } from '../engine/backtest.engine';
import { runEngineBacktest } from './engine-backtest';

const CFG: BacktestConfig = {
  autoBuyThresholdPct: 1, // buy when ask ≤ avg·0.99
  autoSellThresholdPct: 2, // arb-sell when bid ≥ avg·1.02
  trailingTakeProfitPct: 3,
  stopLossPct: 5, // stop when bid ≤ entry·0.95
  tradeAmountPct: 100,
  slippage: 0.01,
  initialBalance: 1000,
};

// Exercises: buy → arb-sell → buy → stop-loss → buy → trailing-sell.
const TICKS: BacktestTick[] = [
  { time: 0, index: 0, tradingBid: 98, tradingAsk: 99, avgRefMid: 100 }, // buy @99
  { time: 1_000, index: 1, tradingBid: 100, tradingAsk: 100, avgRefMid: 100 }, // hold
  { time: 2_000, index: 2, tradingBid: 103, tradingAsk: 103, avgRefMid: 100 }, // arb-sell (bid≥102)
  { time: 3_000, index: 3, tradingBid: 98, tradingAsk: 99, avgRefMid: 100 }, // buy @99
  { time: 4_000, index: 4, tradingBid: 90, tradingAsk: 91, avgRefMid: 100 }, // stop-loss (bid≤94.05)
  { time: 5_000, index: 5, tradingBid: 98, tradingAsk: 99, avgRefMid: 100 }, // buy @99
  { time: 6_000, index: 6, tradingBid: 108, tradingAsk: 109, avgRefMid: 110 }, // hold (peak 108)
  { time: 7_000, index: 7, tradingBid: 104, tradingAsk: 105, avgRefMid: 110 }, // trailing-sell (bid≤104.76)
];

describe('engine-backtest parity with BacktestEngine', () => {
  const legacy = new BacktestEngine(CFG).run(TICKS);
  const engine = runEngineBacktest(TICKS, CFG);

  it('produces the same number of trades', () => {
    expect(engine.totalTrades).toBe(legacy.totalTrades);
    expect(engine.buyCount).toBe(legacy.buyCount);
    expect(engine.sellCount).toBe(legacy.sellCount);
  });

  it('opens/closes 3 round-trips (6 trades)', () => {
    expect(legacy.totalTrades).toBe(6);
    expect(legacy.trades.map((t) => t.direction)).toEqual([
      'USDC_TO_WETH', 'WETH_TO_USDC',
      'USDC_TO_WETH', 'WETH_TO_USDC',
      'USDC_TO_WETH', 'WETH_TO_USDC',
    ]);
  });

  it('matches each trade (step/direction/price/amounts), ignoring reason', () => {
    expect(engine.trades.length).toBe(legacy.trades.length);
    engine.trades.forEach((t, i) => {
      const l = legacy.trades[i];
      expect({ step: t.step, direction: t.direction, price: t.price, amountIn: t.amountIn, amountOut: t.amountOut })
        .toEqual({ step: l.step, direction: l.direction, price: l.price, amountIn: l.amountIn, amountOut: l.amountOut });
    });
  });

  it('matches the final balances and PnL', () => {
    expect(engine.finalUsdcBalance).toBe(legacy.finalUsdcBalance);
    expect(engine.finalWethBalance).toBe(legacy.finalWethBalance);
    expect(engine.portfolioValue).toBe(legacy.portfolioValue);
    expect(engine.pnl).toBe(legacy.pnl);
    expect(engine.pnlPct).toBe(legacy.pnlPct);
  });

  it('exposes engine analytics (summary/steps) that the legacy result lacks', () => {
    expect(engine.summary.totalSteps).toBe(TICKS.length);
    expect(engine.significantSteps).toBeGreaterThanOrEqual(6);
    expect(engine.steps.length).toBeGreaterThan(0);
  });
});
