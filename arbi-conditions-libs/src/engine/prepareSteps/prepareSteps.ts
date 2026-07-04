/**
 * prepareSteps — trim a full history down to the minimal window `processStep`
 * needs (public entry point).
 *
 * Takes the same params as `processStep` (here you pass the WHOLE history) and
 * returns a `ProcessStepParams` whose `steps` is the smallest suffix that still
 * satisfies every strategy condition. Pipe it straight into `processStep`:
 *
 *   processStep(prepareSteps({ steps: history, strategy }));
 *
 * The required window is derived from the conditions themselves: each declares
 * a `WindowRequirement` via its `window(strategy, side)`, and the engine keeps
 * the max — the largest count, the largest duration, and back to the last
 * transaction if any condition asks. No condition-specific knowledge lives here.
 *
 * The returned window ends at the current step, so `currentIndex` is dropped;
 * `position` is passed through.
 */

import { CONDITIONS } from '../conditions';
import type { MarketStep, ProcessStepParams, Side } from '../types';

const SIDES: Side[] = ['buy', 'sell'];

export function prepareSteps({
  steps,
  strategy,
  currentIndex,
  position,
  conditions,
}: ProcessStepParams): ProcessStepParams {
  const defs = conditions ?? CONDITIONS;
  if (steps.length === 0) return { steps, strategy, position, conditions };

  const lastIndex = steps.length - 1;
  const ci = Math.min(Math.max(currentIndex ?? lastIndex, 0), lastIndex);
  const history = steps.slice(0, ci + 1); // drop future steps
  const last = history.length - 1;
  const current = history[last] as MarketStep;

  // Aggregate what every condition needs, across both sides.
  let neededSteps = 1;
  let maxDurationMs = 0;
  let toLastTransaction = false;
  for (const def of defs) {
    for (const side of SIDES) {
      const req = def.window(strategy, side);
      if (req.steps) neededSteps = Math.max(neededSteps, req.steps);
      if (req.durationMs) maxDurationMs = Math.max(maxDurationMs, req.durationMs);
      if (req.toLastTransaction) toLastTransaction = true;
    }
  }

  // Count-based lookback.
  let keepFrom = Math.max(0, last - (neededSteps - 1));

  // Time-based lookback.
  if (maxDurationMs > 0) {
    const cutoff = current.time - maxDurationMs;
    const idx = history.findIndex((s) => s.time >= cutoff);
    if (idx >= 0) keepFrom = Math.min(keepFrom, idx);
  }

  // Back to the most recent transaction event.
  if (toLastTransaction) {
    for (let i = last; i >= 0; i -= 1) {
      if (history[i]?.events?.transaction) {
        keepFrom = Math.min(keepFrom, i);
        break;
      }
    }
  }

  return { steps: history.slice(keepFrom), strategy, position, conditions };
}
