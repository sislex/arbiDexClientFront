import { describe, expect, it } from 'vitest';

import { prepareSteps } from './prepareSteps';
import { processStep } from '../processStep';
import { step, TEST_STRATEGY, TEST_STRATEGY_2STEPS } from '../__fixtures__/stubs';
import type { StrategyEngineConfig } from '../types';

/** Five qualifying steps, one second apart, no transactions. */
const HISTORY = [
  step(1_000, 100, 101, 102),
  step(2_000, 100, 101, 102),
  step(3_000, 100, 101, 102),
  step(4_000, 100, 101, 102),
  step(5_000, 100, 101, 102),
];

describe('prepareSteps', () => {
  it('keeps only the current step when nothing needs history', () => {
    const { steps } = prepareSteps({ steps: HISTORY, strategy: TEST_STRATEGY });
    expect(steps).toHaveLength(1);
    expect(steps[0]?.time).toBe(5_000);
  });

  it('keeps the last N steps for a count-based lookback', () => {
    const { steps } = prepareSteps({ steps: HISTORY, strategy: TEST_STRATEGY_2STEPS });
    expect(steps.map((s) => s.time)).toEqual([4_000, 5_000]);
  });

  it('keeps steps within the delay window (time-based)', () => {
    const strategy: StrategyEngineConfig = {
      buy: { ...TEST_STRATEGY.buy, requireNoTransactionInProgress: false, minDelayAfterLastFinishedTransactionMs: 2_000 },
      sell: { ...TEST_STRATEGY.sell, requireNoTransactionInProgress: false, minDelayAfterLastFinishedTransactionMs: 2_000 },
    };
    // now = 5000, cutoff = 3000 -> keep steps with time >= 3000.
    const { steps } = prepareSteps({ steps: HISTORY, strategy });
    expect(steps.map((s) => s.time)).toEqual([3_000, 4_000, 5_000]);
  });

  it('keeps back to the most recent transaction event when a side requires it', () => {
    const withTx = [
      step(1_000, 100, 101, 102),
      step(2_000, 100, 101, 102, { events: { transaction: { id: 'tx-1', side: 'buy', status: 'started' } } }),
      step(3_000, 100, 101, 102),
      step(4_000, 100, 101, 102),
    ];
    // TEST_STRATEGY requires no-tx-in-progress -> keep back to the tx at index 1.
    const { steps } = prepareSteps({ steps: withTx, strategy: TEST_STRATEGY });
    expect(steps.map((s) => s.time)).toEqual([2_000, 3_000, 4_000]);
    expect(steps[0]?.events?.transaction?.id).toBe('tx-1');
  });

  it('honors currentIndex and drops future steps', () => {
    // current = index 2 -> history is [0..2]; 2-step lookback keeps [1, 2].
    const { steps, currentIndex } = prepareSteps({
      steps: HISTORY,
      strategy: TEST_STRATEGY_2STEPS,
      currentIndex: 2,
    });
    expect(steps.map((s) => s.time)).toEqual([2_000, 3_000]);
    expect(currentIndex).toBeUndefined(); // current is the last step again
  });

  it('returns an empty window unchanged', () => {
    const { steps } = prepareSteps({ steps: [], strategy: TEST_STRATEGY });
    expect(steps).toEqual([]);
  });

  it('feeds processStep an equivalent decision to the full history', () => {
    const full = processStep({ steps: HISTORY, strategy: TEST_STRATEGY_2STEPS });
    const trimmed = processStep(prepareSteps({ steps: HISTORY, strategy: TEST_STRATEGY_2STEPS }));

    expect(trimmed.transaction.buy).toBe(full.transaction.buy);
    expect(trimmed.condition.buy.avg_observed_higher_than_buy_for_last_steps)
      .toBe(full.condition.buy.avg_observed_higher_than_buy_for_last_steps);
  });
});
