import type { EvalContext, MarketStep } from '@sislex/arbi-conditions-libs';
import { buildStrategyFromConfig, buildGateConditions, StrategyConfigInput } from './strategy-config.mapper';

const CFG: StrategyConfigInput = {
  autoBuyThresholdPct: 1,
  autoSellThresholdPct: 1,
  trailingTakeProfitPct: 2,
  stopLossPct: 3,
};

const ctxFor = (buyQuote: number, sellQuote: number, avg: number): EvalContext => {
  const step: MarketStep = { time: 1_000, quotes: { buyQuote, sellQuote, avgObservedQuote: avg } };
  return { window: [step], current: step, position: null };
};

const gate = (cfg: StrategyConfigInput, id: 'auto_buy' | 'auto_sell') =>
  buildGateConditions(cfg).find((c) => c.id === id)!;

describe('buildStrategyFromConfig', () => {
  it('maps stop-loss and trailing onto the sell trigger fields', () => {
    const s = buildStrategyFromConfig(CFG);
    expect(s.sell.stopLossPercent).toBe(3);
    expect(s.sell.trailingTakeProfitPercent).toBe(2);
    expect(s.sell.maxHoldingTimeMs).toBeNull();
    expect(s.buy.enabled).toBe(true);
    expect(s.sell.enabled).toBe(true);
  });

  it('leaves triggers off when the config fields are null', () => {
    const s = buildStrategyFromConfig({ ...CFG, stopLossPct: null, trailingTakeProfitPct: null });
    expect(s.sell.stopLossPercent).toBeNull();
    expect(s.sell.trailingTakeProfitPercent).toBeNull();
  });
});

describe('buildGateConditions', () => {
  describe('auto_buy', () => {
    const c = gate(CFG, 'auto_buy');
    const s = buildStrategyFromConfig(CFG);
    it('passes on buy side when ask ≤ avg·(1 − pct/100)', () => {
      expect(c.evaluate(ctxFor(99, 100, 100), s, 'buy').passed).toBe(true); // buyLevel = 99
    });
    it('fails on buy side when ask is above the buy level', () => {
      expect(c.evaluate(ctxFor(99.5, 100, 100), s, 'buy').passed).toBe(false);
    });
    it('is neutral (passes) on the sell side', () => {
      expect(c.evaluate(ctxFor(200, 100, 100), s, 'sell').passed).toBe(true);
    });
    it('is disabled when autoBuyThresholdPct is null', () => {
      const cNull = gate({ ...CFG, autoBuyThresholdPct: null }, 'auto_buy');
      expect(cNull.evaluate(ctxFor(1, 100, 100), s, 'buy').passed).toBe(false);
    });
  });

  describe('auto_sell', () => {
    const c = gate(CFG, 'auto_sell');
    const s = buildStrategyFromConfig(CFG);
    it('passes on sell side when bid ≥ avg·(1 + pct/100)', () => {
      expect(c.evaluate(ctxFor(100, 101, 100), s, 'sell').passed).toBe(true); // sellLevel = 101
    });
    it('fails on sell side when bid is below the sell level', () => {
      expect(c.evaluate(ctxFor(100, 100.5, 100), s, 'sell').passed).toBe(false);
    });
    it('is neutral (passes) on the buy side', () => {
      expect(c.evaluate(ctxFor(100, 1, 100), s, 'buy').passed).toBe(true);
    });
    it('is disabled when autoSellThresholdPct is null', () => {
      const cNull = gate({ ...CFG, autoSellThresholdPct: null }, 'auto_sell');
      expect(cNull.evaluate(ctxFor(100, 999, 100), s, 'sell').passed).toBe(false);
    });
  });
});
