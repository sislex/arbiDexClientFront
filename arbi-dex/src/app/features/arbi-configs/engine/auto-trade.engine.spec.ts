import { AutoTradeEngine, AutoTradeConfig } from './auto-trade.engine';

const base: AutoTradeConfig = {
  autoBuyThresholdPct: 1, // buy when ask ≤ avg·0.99
  autoSellThresholdPct: 2, // arb-sell when bid ≥ avg·1.02
  trailingTakeProfitPct: 3,
  stopLossPct: 5, // stop when bid ≤ entry·0.95
  tradeAmountPct: 100,
  slippage: 0,
};

const make = (over: Partial<AutoTradeConfig> = {}) =>
  new AutoTradeEngine({ ...base, ...over } as never);

describe('AutoTradeEngine (shared-engine adapter)', () => {
  it('starts flat', () => {
    const e = make();
    expect(e.hasPosition).toBe(false);
    expect(e.buyPrice).toBe(0);
  });

  it('does not buy when autoBuyThresholdPct is null', () => {
    const e = make({ autoBuyThresholdPct: null });
    expect(e.tick(98, 99, 100).action).toBe('none');
  });

  it('buys when ask ≤ avg·(1 − autoBuyThresholdPct/100)', () => {
    const e = make();
    expect(e.tick(98, 99, 100).action).toBe('buy'); // buyLevel = 99
    e.onBuy(99);
    expect(e.hasPosition).toBe(true);
    expect(e.buyPrice).toBe(99);
  });

  it('does not buy when ask is above the buy level', () => {
    const e = make();
    expect(e.tick(98, 99.5, 100).action).toBe('none');
  });

  it('sells via stop-loss when bid ≤ entry·(1 − stopLossPct/100)', () => {
    const e = make({ autoSellThresholdPct: null, trailingTakeProfitPct: null });
    e.tick(98, 99, 100);
    e.onBuy(99);
    const r = e.tick(94, 95, 100); // stopLevel = 99·0.95 = 94.05
    expect(r.action).toBe('sell');
    expect(r.reason).toContain('Stop-loss');
    expect(e.stopLossLevel).toBeCloseTo(94.05, 4);
  });

  it('sells via take-profit when bid ≥ entry·(1 + trailingTakeProfitPct/100)', () => {
    const e = make({ autoSellThresholdPct: null, stopLossPct: null });
    e.tick(98, 99, 100);
    e.onBuy(99);
    expect(e.tick(100, 101, 100).action).toBe('none'); // target = 99·1.03 = 101.97
    const r = e.tick(102, 103, 100); // bid 102 ≥ 101.97
    expect(r.action).toBe('sell');
    expect(r.reason).toContain('Take-profit');
    expect(e.trailingSellLevel).toBeCloseTo(101.97, 2);
  });

  it('sells via arbitrage when bid ≥ avg·(1 + autoSellThresholdPct/100)', () => {
    const e = make({ trailingTakeProfitPct: null, stopLossPct: null });
    e.tick(98, 99, 100);
    e.onBuy(99);
    const r = e.tick(103, 104, 100); // sellLevel = 102
    expect(r.action).toBe('sell');
    expect(r.reason).toContain('Arb');
  });

  it('exposes the auto-buy level only while flat', () => {
    const e = make();
    expect(e.getAutoBuyLevel(100)).toBeCloseTo(99, 4);
    e.tick(98, 99, 100);
    e.onBuy(99);
    expect(e.getAutoBuyLevel(100)).toBe(0);
  });

  it('resets to a flat state', () => {
    const e = make();
    e.tick(98, 99, 100);
    e.onBuy(99);
    e.reset();
    expect(e.hasPosition).toBe(false);
    expect(e.peakSellPrice).toBe(0);
  });
});
