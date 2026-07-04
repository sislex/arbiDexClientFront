import type { MarketStep } from '../types';

/**
 * The current step: the last element of the window.
 * Throws when the window is empty, so downstream code can treat the current
 * step as always present.
 */
export function lastStep(steps: MarketStep[]): MarketStep {
  const step = steps[steps.length - 1];
  if (!step) {
    throw new Error('processStep: steps must contain at least one step');
  }
  return step;
}
