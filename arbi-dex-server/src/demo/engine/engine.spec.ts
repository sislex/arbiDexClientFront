import { generateQuoteSeries } from './quotes';
import { simulateBacktest } from './simulate';
import { runAutotune } from './autotune';
import { defaultStrategySides } from './conditions-catalog';
import { MARKETS } from './markets';
import { NOW } from './markets';

describe('demo engine', () => {
  const quotes = generateQuoteSeries({ seed: 'mc_eth', count: 180, intervalSec: 60, endTime: NOW, basePrice: 3200 });
  const sides = defaultStrategySides();
  const strategy = { buy: sides.buy, sell: sides.sell };

  it('generates a deterministic quote series', () => {
    expect(quotes).toHaveLength(180);
    const again = generateQuoteSeries({ seed: 'mc_eth', count: 180, intervalSec: 60, endTime: NOW, basePrice: 3200 });
    expect(again[100]).toEqual(quotes[100]);
  });

  it('produces trades on the default strategy', () => {
    const r = simulateBacktest(quotes, strategy, { initialBalance: 1000 });
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.stats.trades).toBe(r.trades.length);
    expect(r.stats.finalBalance).toBeGreaterThan(0);
  });

  it('autotune returns combos ranked by PnL', () => {
    const at = runAutotune(quotes, strategy, { maxCombos: 24, initialBalance: 1000 });
    expect(at.combos.length).toBeGreaterThan(1);
    expect(at.best).not.toBeNull();
    for (let i = 1; i < at.combos.length; i++) {
      expect(at.combos[i - 1].stats.pnl).toBeGreaterThanOrEqual(at.combos[i].stats.pnl);
    }
  });

  it('exposes 28 curated markets', () => {
    expect(MARKETS).toHaveLength(28);
  });
});
