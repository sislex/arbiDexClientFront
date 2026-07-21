import type { MarketStep } from '@sislex/arbi-conditions-libs';
import type { Side } from './types';

export interface TradeEventSource {
  id: string;
  time: number;
  side: Side;
}

/** Index of the step with the largest `time` still `<= targetTime`. */
export function stepIndexAtOrBefore(steps: MarketStep[], targetTime: number): number {
  let idx = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].time <= targetTime) idx = i;
    else break;
  }
  return idx;
}

/** Attach journal trade events so transaction_delay_ok sees prior buy/sell times. */
export function injectTradeEventsIntoSteps(
  steps: MarketStep[],
  trades: TradeEventSource[],
  upToTime?: number,
): void {
  if (steps.length === 0) return;
  const limit = upToTime ?? Number.POSITIVE_INFINITY;
  for (const trade of trades) {
    if (trade.time > limit) break;
    const idx = stepIndexAtOrBefore(steps, trade.time);
    if (idx < 0) continue;
    steps[idx].events = {
      ...steps[idx].events,
      transaction: {
        id: trade.id,
        side: trade.side,
        status: 'finished',
      },
    };
  }
}
