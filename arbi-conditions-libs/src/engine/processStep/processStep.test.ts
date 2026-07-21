import { describe, expect, it } from 'vitest';

import { processStep, evaluateSide } from './processStep';
import {
  step,
  TEST_STRATEGY,
  TEST_STRATEGY_2STEPS,
  TEST_STRATEGY_DISABLED,
  TEST_STRATEGY_REQUIRE_BALANCE,
  WINDOW_SINGLE,
  WINDOW_TWO_MIXED,
  WINDOW_TWO_QUALIFY,
  WINDOW_TX_CLOSED,
  WINDOW_TX_OPEN,
  WINDOW_WITH_BALANCES,
} from '../__fixtures__/stubs';
import type { ConditionDef, EvalContext } from '../types';

const alwaysPass: ConditionDef = { id: 'always_pass', window: () => ({}), evaluate: () => ({ passed: true }) };
const alwaysFail: ConditionDef = { id: 'always_fail', window: () => ({}), evaluate: () => ({ passed: false }) };

describe('processStep', () => {
  it('passes every buy/sell condition on a single loose step', () => {
    const result = processStep({ steps: WINDOW_SINGLE, strategy: TEST_STRATEGY });

    expect(result.transaction.buy).toBe(true);
    expect(result.transaction.sell).toBe(true);
    expect(result.condition.buy.enabled.passed).toBe(true);
    expect(result.condition.buy.spread_ok.passed).toBe(true);
    expect(result.meta.lastStepTime).toBe(1_000);
    expect(result.meta.transactionInProgress).toBe(false);
    expect(result.meta.lastFinishedTransactionTime).toBeNull();
  });

  it('exposes actual/required on each condition outcome', () => {
    const result = processStep({ steps: WINDOW_SINGLE, strategy: TEST_STRATEGY });
    // spread = pctDiff(100, 101) ≈ -0.99, cap 100.
    expect(result.condition.buy.spread_ok).toMatchObject({ passed: true, required: 100 });
    expect(typeof result.condition.buy.spread_ok.actual).toBe('number');
  });

  it('fails when the strategy is disabled', () => {
    const result = processStep({ steps: WINDOW_SINGLE, strategy: TEST_STRATEGY_DISABLED });

    expect(result.condition.buy.enabled.passed).toBe(false);
    expect(result.condition.sell.enabled.passed).toBe(false);
    expect(result.transaction.buy).toBe(false);
    expect(result.transaction.sell).toBe(false);
  });

  it('throws on an empty window', () => {
    expect(() => processStep({ steps: [], strategy: TEST_STRATEGY })).toThrow(/at least one step/);
  });

  it('treats steps after currentIndex as future', () => {
    // Full 2-step window satisfies the 2-step lookback...
    expect(
      processStep({ steps: WINDOW_TWO_QUALIFY, strategy: TEST_STRATEGY_2STEPS })
        .condition.buy.avg_observed_higher_for_last_steps.passed,
    ).toBe(true);

    // ...but pinning the current step to index 0 leaves only one step.
    const result = processStep({ steps: WINDOW_TWO_QUALIFY, strategy: TEST_STRATEGY_2STEPS, currentIndex: 0 });
    expect(result.meta.lastStepTime).toBe(1_000);
    expect(result.condition.buy.avg_observed_higher_for_last_steps.passed).toBe(false);
  });

  describe('no_transaction_in_progress (uses the whole window)', () => {
    it('blocks while a started transaction stays open', () => {
      const result = processStep({ steps: WINDOW_TX_OPEN, strategy: TEST_STRATEGY });

      expect(result.meta.transactionInProgress).toBe(true);
      expect(result.condition.buy.no_transaction_in_progress.passed).toBe(false);
      expect(result.transaction.buy).toBe(false);
    });

    it('clears once the transaction is finished', () => {
      const result = processStep({ steps: WINDOW_TX_CLOSED, strategy: TEST_STRATEGY });

      expect(result.meta.transactionInProgress).toBe(false);
      expect(result.condition.buy.no_transaction_in_progress.passed).toBe(true);
      expect(result.meta.lastFinishedTransactionTime).toBe(6_000);
      expect(result.meta.lastTransactionTime).toBe(6_000);
      // minDelay is 0 in TEST_STRATEGY → condition is neutral.
      expect(result.condition.buy.transaction_delay_ok.passed).toBe(true);
    });

    it('counts delay from a started buy (not only finished)', () => {
      const buyTx = { id: 'tx-1', side: 'buy' as const, status: 'started' as const };
      const strategy = {
        ...TEST_STRATEGY,
        buy: { ...TEST_STRATEGY.buy, minDelayAfterLastFinishedTransactionMs: 60_000 },
      };
      const tooSoon = processStep({
        steps: [
          step(1_000, 100, 101, 102, { events: { transaction: buyTx } }),
          step(30_000, 100, 101, 102),
        ],
        strategy,
      });
      expect(tooSoon.condition.buy.transaction_delay_ok.passed).toBe(false);

      const ok = processStep({
        steps: [
          step(1_000, 100, 101, 102, { events: { transaction: buyTx } }),
          step(70_000, 100, 101, 102),
        ],
        strategy,
      });
      expect(ok.condition.buy.transaction_delay_ok.passed).toBe(true);
    });
  });

  describe('avg_observed_higher_for_last_steps (lookback)', () => {
    it('fails until the window holds enough steps', () => {
      const result = processStep({ steps: WINDOW_SINGLE, strategy: TEST_STRATEGY_2STEPS });
      expect(result.condition.buy.avg_observed_higher_for_last_steps.passed).toBe(false);
    });

    it('passes when all of the last N steps qualify', () => {
      const result = processStep({ steps: WINDOW_TWO_QUALIFY, strategy: TEST_STRATEGY_2STEPS });
      expect(result.condition.buy.avg_observed_higher_for_last_steps.passed).toBe(true);
      expect(result.transaction.buy).toBe(true);
    });

    it('fails when an earlier step in the window breaks the streak', () => {
      const result = processStep({ steps: WINDOW_TWO_MIXED, strategy: TEST_STRATEGY_2STEPS });
      expect(result.condition.buy.avg_observed_higher_for_last_steps.passed).toBe(false);
      expect(result.transaction.buy).toBe(false);
    });
  });

  describe('balance_ok (current step)', () => {
    it('fails when the required balance is missing', () => {
      const result = processStep({ steps: WINDOW_SINGLE, strategy: TEST_STRATEGY_REQUIRE_BALANCE });
      expect(result.condition.buy.balance_ok.passed).toBe(false);
      expect(result.transaction.buy).toBe(false);
    });

    it('passes when the current step supplies enough balance', () => {
      const result = processStep({ steps: WINDOW_WITH_BALANCES, strategy: TEST_STRATEGY_REQUIRE_BALANCE });
      expect(result.condition.buy.balance_ok.passed).toBe(true);
      expect(result.condition.sell.balance_ok.passed).toBe(true);
      expect(result.transaction.buy).toBe(true);
    });
  });

  describe('custom conditions registry', () => {
    it('evaluates a custom conditions array passed to processStep', () => {
      const passing = processStep({ steps: WINDOW_SINGLE, strategy: TEST_STRATEGY, conditions: [alwaysPass] });
      expect(passing.transaction.buy).toBe(true);
      expect(passing.condition.buy.always_pass?.passed).toBe(true);

      const failing = processStep({ steps: WINDOW_SINGLE, strategy: TEST_STRATEGY, conditions: [alwaysFail] });
      expect(failing.transaction.buy).toBe(false);
      expect(failing.condition.buy.always_fail?.passed).toBe(false);
    });

    it('evaluateSide ANDs a custom set directly', () => {
      const current = WINDOW_SINGLE[0]!;
      const ctx: EvalContext = { window: WINDOW_SINGLE, current, position: null };
      expect(evaluateSide(ctx, TEST_STRATEGY, 'buy', [alwaysPass]).passed).toBe(true);
      expect(evaluateSide(ctx, TEST_STRATEGY, 'buy', [alwaysPass, alwaysFail]).passed).toBe(false);
    });
  });

  it('enforces the spread limit off the current step', () => {
    const tightStrategy = {
      buy: { ...TEST_STRATEGY.buy, maxBuySellSpreadPercent: 0 },
      sell: { ...TEST_STRATEGY.sell, maxBuySellSpreadPercent: 0 },
    };
    // buy 200 vs sell 100 -> +100% spread, exceeds the 0% cap.
    const window = [step(1_000, 200, 100, 210)];
    const result = processStep({ steps: window, strategy: tightStrategy });
    expect(result.condition.buy.spread_ok.passed).toBe(false);
  });
});
