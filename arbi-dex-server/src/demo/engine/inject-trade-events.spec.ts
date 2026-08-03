import type { MarketStep } from '@sislex/arbi-conditions-libs';
import { injectTradeEventsIntoSteps, stepIndexAtOrBefore } from './inject-trade-events';

function step(time: number): MarketStep {
  return {
    time,
    quotes: { buyQuote: 100, sellQuote: 99, avgObservedQuote: 100 },
  };
}

describe('injectTradeEventsIntoSteps', () => {
  it('attaches by signalTime even when fill time is after the quote tip', () => {
    const steps = [step(1_000), step(2_000), step(3_000)];
    injectTradeEventsIntoSteps(
      steps,
      [{ id: 't1', time: 3_500, side: 'buy', signalTime: 2_000 }],
      3_000,
    );
    expect(steps[1].events?.transaction).toMatchObject({ id: 't1', side: 'buy', status: 'finished' });
    expect(steps[2].events?.transaction).toBeUndefined();
  });

  it('clamps lagged fills without signalTime so delay can see them before the tip', () => {
    const steps = [step(1_000), step(2_000), step(3_000)];
    injectTradeEventsIntoSteps(
      steps,
      [{ id: 't1', time: 3_200, side: 'buy' }],
      3_000,
    );
    // Parked on previous step — lastTransactionTimeBeforeCurrent will see it.
    expect(steps[1].events?.transaction).toMatchObject({ id: 't1', side: 'buy' });
    expect(steps[2].events?.transaction).toBeUndefined();
  });

  it('does not drop a successful buy that finished after the decision step', () => {
    const steps = [step(1_785_486_770_569), step(1_785_486_796_688)];
    injectTradeEventsIntoSteps(
      steps,
      [
        {
          id: 'buy-1',
          time: 1_785_486_797_070,
          side: 'buy',
          signalTime: 1_785_486_770_569,
        },
      ],
      1_785_486_796_688,
    );
    expect(steps[0].events?.transaction?.id).toBe('buy-1');
  });

  it('stepIndexAtOrBefore returns last eligible index', () => {
    const steps = [step(10), step(20), step(30)];
    expect(stepIndexAtOrBefore(steps, 25)).toBe(1);
    expect(stepIndexAtOrBefore(steps, 5)).toBe(-1);
  });
});
