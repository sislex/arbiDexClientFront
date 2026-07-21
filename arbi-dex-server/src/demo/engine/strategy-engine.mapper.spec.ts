import { runBacktest } from '@sislex/arbi-conditions-libs';
import type { MarketStep } from '@sislex/arbi-conditions-libs';
import { toEngineStrategy } from './strategy-engine.mapper';
import { defaultStrategySides } from './conditions-catalog';
import { generateQuoteSeries } from './quotes';
import { basePriceForPair, NOW } from './markets';
import { QuotePoint } from './types';

function synthSteps(count = 400): { quotes: QuotePoint[]; steps: MarketStep[] } {
  const quotes = generateQuoteSeries({
    seed: 'mapper-spec',
    count,
    intervalSec: 60,
    endTime: NOW,
    basePrice: basePriceForPair('WETH_USDC'),
  });
  const steps = quotes.map((q) => ({
    time: q.time,
    quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
  }));
  return { quotes, steps };
}

describe('toEngineStrategy → runBacktest (demo bots path)', () => {
  it('produces trades on the deterministic synthetic series with default strategy', () => {
    const { steps } = synthSteps();
    const { buy, sell } = defaultStrategySides();
    const { strategy, gates, triggers } = toEngineStrategy(buy, sell);

    const result = runBacktest(steps, strategy, {
      initialBalance: 1000,
      conditions: gates,
      triggerConditions: triggers,
    });

    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.stats.trades).toBe(result.trades.length);
    // finalBalance is internally consistent with the reported pnl.
    expect(result.stats.finalBalance).toBeCloseTo(1000 + result.stats.pnl, 2);
  });

  it('makes no trades when the buy side is disabled', () => {
    const { steps } = synthSteps();
    const { buy, sell } = defaultStrategySides();
    // Disable the buy side entirely via its `enabled` gate.
    const disabledBuy = buy.map((c) => (c.conditionId === 'enabled' ? { ...c, enabled: false } : c));
    const { strategy, gates, triggers } = toEngineStrategy(disabledBuy, sell);

    const result = runBacktest(steps, strategy, {
      initialBalance: 1000,
      conditions: gates,
      triggerConditions: triggers,
    });

    expect(result.trades.length).toBe(0);
    expect(result.stats.finalBalance).toBe(1000);
  });

  it('maps sell triggers onto the engine (stop-loss/trailing/max-hold set from config)', () => {
    const { sell } = defaultStrategySides();
    const { strategy } = toEngineStrategy(defaultStrategySides().buy, sell);
    expect(strategy.sell.stopLossPercent).not.toBeNull();
    expect(strategy.sell.trailingTakeProfitPercent).not.toBeNull();
    expect(strategy.sell.maxHoldingTimeMs).not.toBeNull();
  });

  it('maps all enabled gate conditions (no-tx, delay, balance)', () => {
    const { buy, sell } = defaultStrategySides();
    const { strategy, gates } = toEngineStrategy(buy, sell);

    expect(strategy.buy.requireNoTransactionInProgress).toBe(true);
    expect(strategy.sell.requireNoTransactionInProgress).toBe(true);
    expect(strategy.buy.minDelayAfterLastFinishedTransactionMs).toBeGreaterThan(0);
    expect(strategy.sell.minDelayAfterLastFinishedTransactionMs).toBeGreaterThan(0);

    const gateIds = gates.map((g) => g.id);
    expect(gateIds).toContain('no_transaction_in_progress');
    expect(gateIds).toContain('transaction_delay_ok');
    expect(gateIds).toContain('balance_ok');
  });
});
