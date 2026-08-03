import type { MarketStep } from '@sislex/arbi-conditions-libs';
import type { Side } from './types';

export interface TradeEventSource {
  id: string;
  time: number;
  side: Side;
  /**
   * Время шага котировки, на котором принято решение (из stepResult.step.time).
   * Предпочтительнее wall-clock `time`: исполнение часто на несколько секунд позже
   * последнего шага, и без signalTime сделка выпадала из окна delay.
   */
  signalTime?: number | null;
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
    const signalTime =
      trade.signalTime != null && Number.isFinite(trade.signalTime) ? trade.signalTime : null;
    // Решение стратегии → на шаг сигнала; иначе fill time, зажатый в окно котировок.
    let eventTime = signalTime ?? trade.time;
    if (eventTime > limit) {
      if (signalTime != null) continue; // сигнал в будущем относительно окна — пропускаем
      // Fill после tip (латентность квотера/сети): считаем сделку на tip.
      eventTime = limit;
    }
    let idx = stepIndexAtOrBefore(steps, eventTime);
    if (idx < 0) continue;
    // transaction_delay_ok смотрит шаги ДО текущего. Fill, прижатый к tip,
    // на следующем тике tip сдвинется — но на тике сразу после покупки tip ещё
    // может быть равен eventTime; тогда паркуем на предыдущий шаг, чтобы delay
    // увидел последнюю сделку.
    if (
      idx === steps.length - 1 &&
      steps.length >= 2 &&
      signalTime == null &&
      trade.time >= steps[idx].time
    ) {
      idx -= 1;
    }
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
