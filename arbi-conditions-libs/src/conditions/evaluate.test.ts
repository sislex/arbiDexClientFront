import { describe, expect, it } from 'vitest';

import { evaluateCondition, evaluateConfig, allConditionsMet } from './evaluate';
import type { AnalyticsCondition, ConditionsConfig, PriceContext } from './types';

const cond = (type: AnalyticsCondition['type'], thresholdPct: number, enabled = true): AnalyticsCondition => ({
  id: `${type}-${thresholdPct}`,
  type,
  thresholdPct,
  enabled,
});

describe('evaluateCondition', () => {
  describe('OBSERVED_ABOVE_BUY', () => {
    const ctx: PriceContext = { observedPrice: 100.5, buyPrice: 100, sellPrice: 100 };
    it('passes when observed exceeds buy by more than the threshold', () => {
      expect(evaluateCondition(cond('OBSERVED_ABOVE_BUY', 0.02), ctx)).toBe(true); // 0.5% > 0.02%
    });
    it('fails when the margin is below the threshold', () => {
      expect(evaluateCondition(cond('OBSERVED_ABOVE_BUY', 1), ctx)).toBe(false); // 0.5% < 1%
    });
  });

  describe('OBSERVED_BELOW_SELL', () => {
    const ctx: PriceContext = { observedPrice: 99.5, buyPrice: 100, sellPrice: 100 };
    it('passes when observed is below sell by more than the threshold', () => {
      expect(evaluateCondition(cond('OBSERVED_BELOW_SELL', 0.02), ctx)).toBe(true);
    });
    it('fails when observed is not far enough below sell', () => {
      expect(evaluateCondition(cond('OBSERVED_BELOW_SELL', 1), ctx)).toBe(false);
    });
  });

  describe('SPREAD_WITHIN', () => {
    it('passes when spread is under the threshold', () => {
      const ctx: PriceContext = { observedPrice: 100, buyPrice: 100.01, sellPrice: 100 };
      expect(evaluateCondition(cond('SPREAD_WITHIN', 0.03), ctx)).toBe(true); // 0.01% < 0.03%
    });
    it('fails when spread exceeds the threshold', () => {
      const ctx: PriceContext = { observedPrice: 100, buyPrice: 110, sellPrice: 100 };
      expect(evaluateCondition(cond('SPREAD_WITHIN', 0.03), ctx)).toBe(false);
    });
    it('fails safely when sellPrice is 0', () => {
      const ctx: PriceContext = { observedPrice: 0, buyPrice: 0, sellPrice: 0 };
      expect(evaluateCondition(cond('SPREAD_WITHIN', 0.03), ctx)).toBe(false);
    });
  });
});

describe('evaluateConfig / allConditionsMet', () => {
  const ctx: PriceContext = { observedPrice: 100.5, buyPrice: 100, sellPrice: 100.6 };
  const config: ConditionsConfig = {
    version: 1,
    conditions: [
      cond('OBSERVED_ABOVE_BUY', 0.02), // observed 100.5 > buy 100.02 -> pass
      cond('SPREAD_WITHIN', 1), // |100-100.6|/100.6 = 0.596% < 1% -> pass
      cond('OBSERVED_BELOW_SELL', 0.02, false), // disabled -> skipped
    ],
  };

  it('skips disabled conditions', () => {
    const results = evaluateConfig(config, ctx);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.type)).toEqual(['OBSERVED_ABOVE_BUY', 'SPREAD_WITHIN']);
  });

  it('reports per-condition satisfaction', () => {
    const results = evaluateConfig(config, ctx);
    expect(results.every((r) => r.satisfied)).toBe(true);
  });

  it('allConditionsMet true when every enabled condition passes', () => {
    expect(allConditionsMet(config, ctx)).toBe(true);
  });

  it('allConditionsMet false when one enabled condition fails', () => {
    const strict: ConditionsConfig = {
      version: 1,
      conditions: [cond('OBSERVED_ABOVE_BUY', 5)], // needs 5% margin, only ~0.5% -> fail
    };
    expect(allConditionsMet(strict, ctx)).toBe(false);
  });
});
