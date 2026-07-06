import { describe, expect, it } from 'vitest';

import { processStep } from './processStep';
import { prepareSteps } from '../prepareSteps';
import {
  step,
  TEST_POSITION,
  TEST_STRATEGY,
  TEST_STRATEGY_STOP_LOSS,
  TEST_STRATEGY_TRAILING,
  TEST_STRATEGY_MAX_HOLD,
  WINDOW_STOP_HIT,
  WINDOW_STOP_MISS,
  WINDOW_TRAILING_HIT,
  WINDOW_TRAILING_MISS,
  WINDOW_MAX_HOLD_HIT,
} from '../__fixtures__/stubs';

describe('sell trigger conditions (forcedSell)', () => {
  describe('stop_loss', () => {
    it('fires when the exit price is below the stop level (with position)', () => {
      const r = processStep({ steps: WINDOW_STOP_HIT, strategy: TEST_STRATEGY_STOP_LOSS, position: TEST_POSITION });
      expect(r.condition.sell.stop_loss?.passed).toBe(true);
      expect(r.transaction.forcedSell).toBe(true);
    });

    it('does not fire when the exit price is above the stop level', () => {
      const r = processStep({ steps: WINDOW_STOP_MISS, strategy: TEST_STRATEGY_STOP_LOSS, position: TEST_POSITION });
      expect(r.condition.sell.stop_loss?.passed).toBe(false);
      expect(r.transaction.forcedSell).toBe(false);
    });

    it('does not fire without an open position', () => {
      const r = processStep({ steps: WINDOW_STOP_HIT, strategy: TEST_STRATEGY_STOP_LOSS, position: null });
      expect(r.condition.sell.stop_loss?.passed).toBe(false);
      expect(r.transaction.forcedSell).toBe(false);
    });

    it('does not fire when stopLossPercent is not configured', () => {
      const r = processStep({ steps: WINDOW_STOP_HIT, strategy: TEST_STRATEGY, position: TEST_POSITION });
      expect(r.condition.sell.stop_loss?.passed).toBe(false);
      expect(r.transaction.forcedSell).toBe(false);
    });
  });

  describe('trailing_take_profit', () => {
    it('fires on a pullback past the trailing level from the post-entry peak', () => {
      const r = processStep({ steps: WINDOW_TRAILING_HIT, strategy: TEST_STRATEGY_TRAILING, position: TEST_POSITION });
      expect(r.condition.sell.trailing_take_profit?.passed).toBe(true);
      expect(r.transaction.forcedSell).toBe(true);
    });

    it('does not fire on a shallow pullback', () => {
      const r = processStep({ steps: WINDOW_TRAILING_MISS, strategy: TEST_STRATEGY_TRAILING, position: TEST_POSITION });
      expect(r.condition.sell.trailing_take_profit?.passed).toBe(false);
      expect(r.transaction.forcedSell).toBe(false);
    });

    it('does not fire when never in profit above entry', () => {
      // Peak never rises above entry (100) → trailing cannot arm.
      const flat = [step(1_000, 100, 100, 100), step(2_000, 100, 99, 99)];
      const r = processStep({ steps: flat, strategy: TEST_STRATEGY_TRAILING, position: TEST_POSITION });
      expect(r.condition.sell.trailing_take_profit?.passed).toBe(false);
    });
  });

  describe('max_holding_time', () => {
    it('fires once the position has been held long enough', () => {
      const r = processStep({ steps: WINDOW_MAX_HOLD_HIT, strategy: TEST_STRATEGY_MAX_HOLD, position: TEST_POSITION });
      expect(r.condition.sell.max_holding_time?.passed).toBe(true);
      expect(r.transaction.forcedSell).toBe(true);
    });

    it('does not fire before the holding limit', () => {
      const early = [step(1_000, 100, 100, 100), step(3_000, 100, 100, 100)]; // held 2000ms < 5000ms
      const r = processStep({ steps: early, strategy: TEST_STRATEGY_MAX_HOLD, position: TEST_POSITION });
      expect(r.condition.sell.max_holding_time?.passed).toBe(false);
      expect(r.transaction.forcedSell).toBe(false);
    });
  });

  it('forcedSell is OR across triggers, independent of the sell gates', () => {
    const r = processStep({ steps: WINDOW_STOP_HIT, strategy: TEST_STRATEGY_STOP_LOSS, position: TEST_POSITION });
    // forcedSell reflects the trigger, not the gate AND.
    expect(r.transaction.forcedSell).toBe(true);
    // gate result (transaction.sell) is computed separately and still present.
    expect(typeof r.transaction.sell).toBe('boolean');
  });

  it('has no triggers firing when no trigger strategy fields are set', () => {
    const r = processStep({ steps: WINDOW_STOP_HIT, strategy: TEST_STRATEGY, position: TEST_POSITION });
    expect(r.transaction.forcedSell).toBe(false);
  });

  describe('prepareSteps with sincePositionOpen (trailing)', () => {
    it('keeps history back to when the position opened', () => {
      const history = [
        step(1_000, 100, 100, 100),
        step(2_000, 100, 100, 100),
        step(3_000, 100, 110, 110), // position opens here
        step(4_000, 100, 108, 108),
        step(5_000, 100, 106, 106),
      ];
      const position = { entryPrice: 100, size: 1, openedAt: 3_000 };
      const { steps } = prepareSteps({ steps: history, strategy: TEST_STRATEGY_TRAILING, position });
      // Must reach back to t=3000 (the open) for the trailing peak.
      expect(steps[0]?.time).toBe(3_000);
      expect(steps.map((s) => s.time)).toEqual([3_000, 4_000, 5_000]);
    });
  });
});
