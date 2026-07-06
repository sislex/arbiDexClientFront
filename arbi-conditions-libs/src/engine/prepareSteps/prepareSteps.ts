/**
 * prepareSteps — trim a full history down to the minimal window `processStep`
 * needs (public entry point).
 *
 * Takes the same params as `processStep` (here you pass the WHOLE history) and
 * returns a `ProcessStepParams` whose `steps` is the smallest suffix that still
 * satisfies every strategy condition. Pipe it straight into `processStep`:
 *
 *   processStep(prepareSteps({ steps: history, strategy, position }));
 *
 * The required window is derived from the conditions themselves: each declares a
 * `WindowRequirement` via its `window(strategy, side)`, and the engine keeps the
 * max — the largest count, the largest duration, back to the last transaction,
 * and (with an open position) back to when the position opened, if any condition
 * asks. Gate conditions are considered on both sides; trigger conditions on the
 * sell side. No condition-specific knowledge lives here.
 *
 * The returned window ends at the current step, so `currentIndex` is dropped;
 * `position`, `conditions` and `triggerConditions` are passed through.
 */

import { CONDITIONS, TRIGGER_CONDITIONS } from '../conditions';
import type { ConditionDef, MarketStep, ProcessStepParams, Side, WindowRequirement } from '../types';
import type { StrategyEngineConfig } from '../types';

const SIDES: Side[] = ['buy', 'sell'];

export function prepareSteps({
  steps,
  strategy,
  currentIndex,
  position,
  conditions,
  triggerConditions,
}: ProcessStepParams): ProcessStepParams {
  const gates = conditions ?? CONDITIONS;
  const triggers = triggerConditions ?? TRIGGER_CONDITIONS;
  const pass = { steps, strategy, position, conditions, triggerConditions };
  if (steps.length === 0) return pass;

  const lastIndex = steps.length - 1;
  const ci = Math.min(Math.max(currentIndex ?? lastIndex, 0), lastIndex);
  const history = steps.slice(0, ci + 1); // drop future steps
  const last = history.length - 1;
  const current = history[last] as MarketStep;

  // Aggregate what every condition needs.
  let neededSteps = 1;
  let maxDurationMs = 0;
  let toLastTransaction = false;
  let sincePositionOpen = false;

  const collect = (req: WindowRequirement) => {
    if (req.steps) neededSteps = Math.max(neededSteps, req.steps);
    if (req.durationMs) maxDurationMs = Math.max(maxDurationMs, req.durationMs);
    if (req.toLastTransaction) toLastTransaction = true;
    if (req.sincePositionOpen) sincePositionOpen = true;
  };
  const collectFrom = (defs: ConditionDef[], sides: Side[], cfg: StrategyEngineConfig) => {
    for (const def of defs) for (const side of sides) collect(def.window(cfg, side));
  };
  collectFrom(gates, SIDES, strategy);
  collectFrom(triggers, ['sell'], strategy); // triggers only run on the sell side

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

  // Back to when the position opened (only meaningful with an open position).
  if (sincePositionOpen && position) {
    const idx = history.findIndex((s) => s.time >= position.openedAt);
    if (idx >= 0) keepFrom = Math.min(keepFrom, idx);
  }

  return {
    steps: history.slice(keepFrom),
    strategy,
    position,
    conditions,
    triggerConditions,
  };
}
