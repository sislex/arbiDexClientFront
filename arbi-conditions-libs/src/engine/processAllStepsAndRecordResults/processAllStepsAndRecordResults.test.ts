import { describe, expect, it, vi } from 'vitest';

import { processAllStepsAndRecordResults } from './processAllStepsAndRecordResults';
import {
  TEST_STRATEGY,
  TEST_STRATEGY_2STEPS,
  WINDOW_TWO_QUALIFY,
} from '../__fixtures__/stubs';

describe('processAllStepsAndRecordResults', () => {
  it('records each step with its index and step reference', () => {
    const { records } = processAllStepsAndRecordResults({ steps: WINDOW_TWO_QUALIFY, strategy: TEST_STRATEGY });

    expect(records).toHaveLength(2);
    expect(records[0]?.index).toBe(0);
    expect(records[0]?.step).toBe(WINDOW_TWO_QUALIFY[0]);
    expect(records[1]?.index).toBe(1);
    expect(records[1]?.step).toBe(WINDOW_TWO_QUALIFY[1]);
  });

  it('invokes onRecord once per step, in order', () => {
    const onRecord = vi.fn();
    processAllStepsAndRecordResults({ steps: WINDOW_TWO_QUALIFY, strategy: TEST_STRATEGY, onRecord });

    expect(onRecord).toHaveBeenCalledTimes(2);
    expect(onRecord.mock.calls[0]?.[0].index).toBe(0);
    expect(onRecord.mock.calls[1]?.[0].index).toBe(1);
  });

  it('evaluates each record over the growing window', () => {
    const { records } = processAllStepsAndRecordResults({ steps: WINDOW_TWO_QUALIFY, strategy: TEST_STRATEGY_2STEPS });
    expect(records[0]?.result.condition.buy.avg_observed_higher_for_last_steps.passed).toBe(false);
    expect(records[1]?.result.condition.buy.avg_observed_higher_for_last_steps.passed).toBe(true);
  });

  it('returns no records for empty input', () => {
    const onRecord = vi.fn();
    const { records } = processAllStepsAndRecordResults({ steps: [], strategy: TEST_STRATEGY, onRecord });
    expect(records).toEqual([]);
    expect(onRecord).not.toHaveBeenCalled();
  });
});
