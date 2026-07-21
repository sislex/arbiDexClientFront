import { describe, expect, it } from 'vitest';
import { runBacktest } from './runBacktest';
import { TRIGGER_CONDITIONS, transactionDelayOkCondition } from '../conditions';
import { step } from '../__fixtures__/stubs';
import type { ConditionDef, StrategyEngineConfig } from '../types';

/**
 * Custom gate conditions that make signals deterministic and independent of the
 * built-in gates: buy fires when the ask is at/under `buyLevel`, sell fires when
 * the bid is at/over `sellLevel`. Each is neutral (passes) on the other side so
 * it never blocks that side's gate.
 */
function levelGates(buyLevel: number, sellLevel: number): ConditionDef[] {
  const autoBuy: ConditionDef = {
    id: 'auto_buy',
    window: () => ({}),
    evaluate: (ctx, _s, side) =>
      side === 'buy' ? { passed: ctx.current.quotes.buyQuote <= buyLevel } : { passed: true },
  };
  const autoSell: ConditionDef = {
    id: 'auto_sell',
    window: () => ({}),
    evaluate: (ctx, _s, side) =>
      side === 'sell' ? { passed: ctx.current.quotes.sellQuote >= sellLevel } : { passed: true },
  };
  return [autoBuy, autoSell];
}

/** Permissive strategy — the built-in gates never block; custom gates decide. */
const PERMISSIVE: StrategyEngineConfig = {
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
    stopLossPercent: null,
    trailingTakeProfitPercent: null,
    maxHoldingTimeMs: null,
  },
};

describe('runBacktest', () => {
  it('opens on a buy signal and closes on a sell signal with correct P&L', () => {
    const steps = [
      step(1_000, 100, 100, 100), // buy fires (ask 100 <= 100)
      step(2_000, 105, 105, 105), // nothing
      step(3_000, 112, 112, 112), // sell fires (bid 112 >= 110)
    ];
    const result = runBacktest(steps, PERMISSIVE, {
      initialBalance: 1000,
      conditions: levelGates(100, 110),
      triggerConditions: [],
    });

    expect(result.trades).toHaveLength(2);
    expect(result.trades[0]).toMatchObject({ side: 'buy', price: 100, amount: 10, reason: 'auto_buy' });
    expect(result.trades[1]).toMatchObject({ side: 'sell', price: 112, amount: 10, pnl: 120 });
    expect(result.stats).toMatchObject({
      trades: 2,
      pnl: 120,
      pnlPct: 12,
      winRate: 100,
      finalBalance: 1120,
    });
    expect(result.from).toBe(1_000);
    expect(result.to).toBe(3_000);
    expect(result.summary.buySignals).toBe(1);
    expect(result.summary.sellSignals).toBe(1);
  });

  it('force-closes an open position at the last step', () => {
    const steps = [
      step(1_000, 100, 100, 100), // buy fires
      step(2_000, 100, 105, 105), // sell never gate-fires (level 999)
    ];
    const result = runBacktest(steps, PERMISSIVE, {
      initialBalance: 1000,
      conditions: levelGates(100, 999),
      triggerConditions: [],
    });

    expect(result.trades).toHaveLength(2);
    expect(result.trades[1]).toMatchObject({ side: 'sell', reason: 'close_at_end', price: 105, pnl: 50 });
    expect(result.stats.finalBalance).toBe(1050);
    expect(result.stats.pnl).toBe(50);
  });

  it('closes via a stop-loss trigger and tracks the drawdown', () => {
    const strategy: StrategyEngineConfig = {
      ...PERMISSIVE,
      sell: { ...PERMISSIVE.sell, stopLossPercent: 5 },
    };
    const steps = [
      step(1_000, 100, 100, 100), // buy at 100 -> stop level 95
      step(2_000, 100, 94, 100), // bid 94 <= 95 -> stop-loss forces a sell
    ];
    const result = runBacktest(steps, strategy, {
      initialBalance: 1000,
      conditions: levelGates(100, 999), // gate-sell never fires
      triggerConditions: TRIGGER_CONDITIONS,
    });

    expect(result.trades).toHaveLength(2);
    expect(result.trades[1]).toMatchObject({ side: 'sell', reason: 'stop_loss', pnl: -60 });
    expect(result.stats.pnl).toBe(-60);
    expect(result.stats.winRate).toBe(0);
    expect(result.stats.maxDrawdownPct).toBe(6);
    expect(result.summary.forcedSells).toBe(1);
  });

  it('applies slippage and tradeAmountPct to fills', () => {
    const steps = [step(1_000, 100, 100, 100), step(2_000, 100, 200, 200)];
    const result = runBacktest(steps, PERMISSIVE, {
      initialBalance: 1000,
      tradeAmountPct: 50, // spend 500
      slippage: 0.01, // 1% against the trader
      conditions: levelGates(100, 150),
      triggerConditions: [],
    });

    // Buy: spend 500 at 100*1.01=101 -> 4.9505 tokens.
    const buy = result.trades[0]!;
    expect(buy.side).toBe('buy');
    expect(buy.amount).toBeCloseTo(500 / 101, 8);
    // Sell: 4.9505 tokens at 200*0.99=198 -> ~980.198; cash = 500 + that.
    const proceeds = (500 / 101) * (200 * 0.99);
    expect(result.stats.finalBalance).toBeCloseTo(Math.round((500 + proceeds) * 100) / 100, 2);
  });

  it('returns empty, zeroed results for an empty series', () => {
    const result = runBacktest([], PERMISSIVE, { initialBalance: 1000 });
    expect(result.trades).toHaveLength(0);
    expect(result.stats).toMatchObject({ trades: 0, pnl: 0, pnlPct: 0, winRate: 0, finalBalance: 1000 });
    expect(result.from).toBe(0);
    expect(result.to).toBe(0);
  });

  it('respects transaction_delay_ok between round-trips', () => {
    const delayMs = 60_000;
    const strategy: StrategyEngineConfig = {
      ...PERMISSIVE,
      buy: { ...PERMISSIVE.buy, minDelayAfterLastFinishedTransactionMs: delayMs },
      sell: { ...PERMISSIVE.sell, minDelayAfterLastFinishedTransactionMs: delayMs },
    };
    const steps = [
      step(0, 100, 100, 100),
      step(100, 100, 110, 110),
      step(200, 100, 110, 110),
      step(70_000, 100, 110, 110),
      step(70_100, 100, 120, 120),
    ];
    const result = runBacktest(steps, strategy, {
      initialBalance: 1000,
      conditions: [...levelGates(100, 110), transactionDelayOkCondition],
      triggerConditions: [],
    });
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0]?.side).toBe('buy');
    expect(result.trades[1]?.side).toBe('sell');
  });

  it('makes no trades when no buy signal ever fires', () => {
    const steps = [step(1_000, 200, 200, 200), step(2_000, 210, 210, 210)];
    const result = runBacktest(steps, PERMISSIVE, {
      initialBalance: 1000,
      conditions: levelGates(100, 110), // ask never <= 100
      triggerConditions: [],
    });
    expect(result.trades).toHaveLength(0);
    expect(result.stats.finalBalance).toBe(1000);
    expect(result.stats.pnl).toBe(0);
    expect(result.summary.conditionStats.find((s) => s.id === 'auto_buy')?.passedCount).toBe(0);
  });
});
