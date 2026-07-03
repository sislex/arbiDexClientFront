import { describe, expect, it } from 'vitest';

import { processStep } from './processStep';
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

describe('processStep', () => {
  it('passes every buy/sell condition on a single loose step', () => {
    const result = processStep(WINDOW_SINGLE, TEST_STRATEGY);

    expect(result.transaction.buy).toBe(true);
    expect(result.transaction.sell).toBe(true);
    expect(result.condition.buy.enabled).toBe(true);
    expect(result.condition.buy.spread_ok).toBe(true);
    expect(result.meta.lastStepTime).toBe(1_000);
    expect(result.meta.transactionInProgress).toBe(false);
    expect(result.meta.lastFinishedTransactionTime).toBeNull();
  });

  it('fails when the strategy is disabled', () => {
    const result = processStep(WINDOW_SINGLE, TEST_STRATEGY_DISABLED);

    expect(result.condition.buy.enabled).toBe(false);
    expect(result.condition.sell.enabled).toBe(false);
    expect(result.transaction.buy).toBe(false);
    expect(result.transaction.sell).toBe(false);
  });

  it('throws on an empty window', () => {
    expect(() => processStep([], TEST_STRATEGY)).toThrow(/at least one step/);
  });

  describe('no_transaction_in_progress (uses the whole window)', () => {
    it('blocks while a started transaction stays open', () => {
      const result = processStep(WINDOW_TX_OPEN, TEST_STRATEGY);

      expect(result.meta.transactionInProgress).toBe(true);
      expect(result.condition.buy.no_transaction_in_progress).toBe(false);
      expect(result.transaction.buy).toBe(false);
    });

    it('clears once the transaction is finished', () => {
      const result = processStep(WINDOW_TX_CLOSED, TEST_STRATEGY);

      expect(result.meta.transactionInProgress).toBe(false);
      expect(result.condition.buy.no_transaction_in_progress).toBe(true);
      expect(result.meta.lastFinishedTransactionTime).toBe(6_000);
      // Current step IS the finished step -> zero elapsed, so the >0 delay fails.
      expect(result.condition.buy.last_finished_transaction_delay_ok).toBe(false);
    });
  });

  describe('avg_observed_higher_than_*_for_last_steps (lookback)', () => {
    it('fails until the window holds enough steps', () => {
      const result = processStep(WINDOW_SINGLE, TEST_STRATEGY_2STEPS);
      expect(result.condition.buy.avg_observed_higher_than_buy_for_last_steps).toBe(false);
    });

    it('passes when all of the last N steps qualify', () => {
      const result = processStep(WINDOW_TWO_QUALIFY, TEST_STRATEGY_2STEPS);
      expect(result.condition.buy.avg_observed_higher_than_buy_for_last_steps).toBe(true);
      expect(result.transaction.buy).toBe(true);
    });

    it('fails when an earlier step in the window breaks the streak', () => {
      const result = processStep(WINDOW_TWO_MIXED, TEST_STRATEGY_2STEPS);
      expect(result.condition.buy.avg_observed_higher_than_buy_for_last_steps).toBe(false);
      expect(result.transaction.buy).toBe(false);
    });
  });

  describe('token balance gate (current step)', () => {
    it('fails when the required balance is missing', () => {
      const result = processStep(WINDOW_SINGLE, TEST_STRATEGY_REQUIRE_BALANCE);
      expect(result.condition.buy.token1_balance_ok).toBe(false);
      expect(result.transaction.buy).toBe(false);
    });

    it('passes when the current step supplies enough balance', () => {
      const result = processStep(WINDOW_WITH_BALANCES, TEST_STRATEGY_REQUIRE_BALANCE);
      expect(result.condition.buy.token1_balance_ok).toBe(true);
      expect(result.condition.sell.token2_balance_ok).toBe(true);
      expect(result.transaction.buy).toBe(true);
    });
  });

  it('enforces the spread limit off the current step', () => {
    const tightStrategy = {
      buy: { ...TEST_STRATEGY.buy, maxBuySellSpreadPercent: 0 },
      sell: { ...TEST_STRATEGY.sell, maxBuySellSpreadPercent: 0 },
    };
    // buy 200 vs sell 100 -> +100% spread, exceeds the 0% cap.
    const window = [step(1_000, 200, 100, 210)];
    const result = processStep(window, tightStrategy);
    expect(result.condition.buy.spread_ok).toBe(false);
  });
});
