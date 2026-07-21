import type { MarketStep, TransactionEvent } from '../types';

/**
 * Whether a transaction is still open across the window.
 *
 * A transaction id is considered open when its last-seen status in the window
 * is `started` (i.e. no later `finished`/`failed` for the same id).
 */
export function isTransactionInProgress(steps: MarketStep[]): boolean {
  const statusById = new Map<string, TransactionEvent['status']>();
  for (const step of steps) {
    const tx = step.events?.transaction;
    if (tx) statusById.set(tx.id, tx.status);
  }
  for (const status of statusById.values()) {
    if (status === 'started') return true;
  }
  return false;
}

/**
 * `time` of the most recent step whose transaction reached `finished`,
 * or `null` when the window has no finished transaction.
 */
export function lastFinishedTransactionTime(steps: MarketStep[]): number | null {
  let time: number | null = null;
  for (const step of steps) {
    if (step.events?.transaction?.status === 'finished') {
      time = step.time;
    }
  }
  return time;
}

/**
 * `time` of the most recent step with any transaction event (buy or sell,
 * started or finished). Matches platform `lastTransactionTs` semantics.
 */
export function lastTransactionTime(steps: MarketStep[]): number | null {
  let time: number | null = null;
  for (const step of steps) {
    if (step.events?.transaction) {
      time = step.time;
    }
  }
  return time;
}

/** Last transaction on a step strictly before the current (last) window step. */
export function lastTransactionTimeBeforeCurrent(steps: MarketStep[]): number | null {
  if (steps.length <= 1) return null;
  return lastTransactionTime(steps.slice(0, -1));
}
