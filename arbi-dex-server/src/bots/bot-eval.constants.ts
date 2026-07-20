/** Max steps evaluated per backtest / step-result request (protects API from overload). */
export const MAX_BOT_EVAL_STEPS = 1000;

/** Keep the most recent steps when the requested window exceeds the cap. */
export function limitEvalSteps<T extends { time: number }>(
  steps: T[],
  maxSteps = MAX_BOT_EVAL_STEPS,
): T[] {
  if (steps.length <= maxSteps) return steps;
  return steps.slice(steps.length - maxSteps);
}
