import { runBacktest } from '@sislex/arbi-conditions-libs';
import type { EvalContext, MarketStep } from '@sislex/arbi-conditions-libs';
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

  it('evaluates balance_ok against the correct side balance field', () => {
    const { buy, sell } = defaultStrategySides();
    const buyWithBalance = buy.map((c) =>
      c.conditionId === 'balance_ok'
        ? { ...c, enabled: true, params: { ...c.params, require: true, minBalance: 10 } }
        : c,
    );
    const sellWithBalance = sell.map((c) =>
      c.conditionId === 'balance_ok'
        ? { ...c, enabled: true, params: { ...c.params, require: true, minBalance: 2 } }
        : c,
    );
    const { strategy, gates } = toEngineStrategy(buyWithBalance, sellWithBalance);
    const balanceGate = gates.find((g) => g.id === 'balance_ok');
    expect(balanceGate).toBeDefined();

    const step: MarketStep = {
      time: 1_000,
      quotes: { buyQuote: 100, sellQuote: 99, avgObservedQuote: 100 },
      balances: { token1: 12, token2: 3 },
    };
    const ctx: EvalContext = { window: [step], current: step, position: null };

    expect(balanceGate!.evaluate(ctx, strategy, 'buy')).toMatchObject({ passed: true, actual: 12, required: 10 });
    expect(balanceGate!.evaluate(ctx, strategy, 'sell')).toMatchObject({ passed: true, actual: 3, required: 2 });
  });

  it('passes sell when sellQuote is above avg by at least percent', () => {
    const { buy, sell } = defaultStrategySides();
    const sellWithTinyAvg = sell.map((c) =>
      c.conditionId === 'avg_observed_higher_for_last_steps'
        ? { ...c, enabled: true, params: { ...c.params, percent: 0.05, steps: 1 } }
        : c,
    );
    const { strategy, gates } = toEngineStrategy(buy, sellWithTinyAvg);
    const avgGate = gates.find((g) => g.id === 'avg_observed_higher_for_last_steps');

    expect(avgGate).toBeDefined();

    const ctx: EvalContext = {
      window: [
        {
          time: 1,
          quotes: {
            buyQuote: 99.8,
            sellQuote: 100.1,
            avgObservedQuote: 100,
          },
        },
      ],
      current: {
        time: 1,
        quotes: {
          buyQuote: 99.8,
          sellQuote: 100.1,
          avgObservedQuote: 100,
        },
      },
      position: null,
    };

    const result = avgGate!.evaluate(ctx, strategy, 'sell');
    expect(result.passed).toBe(true);
    expect(result.actual).toBeCloseTo(0.1, 12);
    expect(result.required).toBe(0.05);
  });

  it('uses the weakest (minimum) sell deviation across multiple steps', () => {
    const { buy, sell } = defaultStrategySides();
    const sellWithAvg = sell.map((c) =>
      c.conditionId === 'avg_observed_higher_for_last_steps'
        ? { ...c, enabled: true, params: { ...c.params, percent: 0.05, steps: 2 } }
        : c,
    );
    const { strategy, gates } = toEngineStrategy(buy, sellWithAvg);
    const avgGate = gates.find((g) => g.id === 'avg_observed_higher_for_last_steps');
    expect(avgGate).toBeDefined();

    const step1: MarketStep = {
      time: 1,
      quotes: { buyQuote: 99.8, sellQuote: 100.2, avgObservedQuote: 100 },
    };
    const step2: MarketStep = {
      time: 2,
      quotes: { buyQuote: 99.8, sellQuote: 100.02, avgObservedQuote: 100 },
    };
    const ctx: EvalContext = { window: [step1, step2], current: step2, position: null };

    const result = avgGate!.evaluate(ctx, strategy, 'sell');
    expect(result.passed).toBe(false);
    expect(result.required).toBe(0.05);
    expect(result.actual).toBeCloseTo(0.02, 8);
  });

  it('allows a negative sell percent (sell below avg still passes)', () => {
    const { buy, sell } = defaultStrategySides();
    const sellNeg = sell.map((c) =>
      c.conditionId === 'avg_observed_higher_for_last_steps'
        ? { ...c, enabled: true, params: { ...c.params, percent: -0.2, steps: 1 } }
        : c,
    );
    const { strategy, gates } = toEngineStrategy(buy, sellNeg);
    const avgGate = gates.find((g) => g.id === 'avg_observed_higher_for_last_steps');
    expect(avgGate).toBeDefined();

    const ctx: EvalContext = {
      window: [
        {
          time: 1,
          quotes: { buyQuote: 100.2, sellQuote: 99.9, avgObservedQuote: 100 },
        },
      ],
      current: {
        time: 1,
        quotes: { buyQuote: 100.2, sellQuote: 99.9, avgObservedQuote: 100 },
      },
      position: null,
    };

    const result = avgGate!.evaluate(ctx, strategy, 'sell');
    expect(result.passed).toBe(true);
    expect(result.actual).toBeCloseTo(-0.1, 8);
    expect(result.required).toBe(-0.2);
  });
});
