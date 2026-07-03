import { describe, expect, it } from 'vitest';

import { processStepArray } from './processStepArray';
import {
  TEST_STRATEGY,
  TEST_STRATEGY_2STEPS,
  WINDOW_TWO_QUALIFY,
  WINDOW_TX_CLOSED,
} from '../__fixtures__/stubs';

describe('processStepArray', () => {
  it('returns an empty array for empty input', () => {
    expect(processStepArray([], TEST_STRATEGY)).toEqual([]);
  });

  it('returns one result per step, in order', () => {
    const results = processStepArray(WINDOW_TWO_QUALIFY, TEST_STRATEGY);
    expect(results).toHaveLength(2);
    expect(results[0]?.meta.lastStepTime).toBe(1_000);
    expect(results[1]?.meta.lastStepTime).toBe(2_000);
  });

  it('grows the lookback window as it advances', () => {
    // steps:2 lookback — the first step has too little history, the second passes.
    const results = processStepArray(WINDOW_TWO_QUALIFY, TEST_STRATEGY_2STEPS);
    expect(results[0]?.condition.buy.avg_observed_higher_than_buy_for_last_steps).toBe(false);
    expect(results[1]?.condition.buy.avg_observed_higher_than_buy_for_last_steps).toBe(true);
  });

  it('reflects transaction state across the window', () => {
    // [started@1000, finished@6000]
    const results = processStepArray(WINDOW_TX_CLOSED, TEST_STRATEGY);
    expect(results[0]?.meta.transactionInProgress).toBe(true);
    expect(results[0]?.condition.buy.no_transaction_in_progress).toBe(false);
    expect(results[1]?.meta.transactionInProgress).toBe(false);
    expect(results[1]?.condition.buy.no_transaction_in_progress).toBe(true);
  });
});
