import {
  evaluateConditions,
  type AnalyticsConditionsConfig,
  type StepQuotes,
} from './trade-analytics.helper';
import { evaluateConditionsViaEngine } from './strategy-engine.adapter';
import conditionsConfigJson from './conditions.config.json';

const config = conditionsConfigJson as AnalyticsConditionsConfig;

/** processStep-based evaluation must reproduce evaluateConditions exactly. */
describe('evaluateConditionsViaEngine', () => {
  const cases: StepQuotes[] = [
    { observedPrice: 100.5, buyPrice: 100, sellPrice: 100.02 }, // buy signal
    { observedPrice: 99.9, buyPrice: 100, sellPrice: 100.5 },   // sell-ish
    { observedPrice: 100, buyPrice: 100, sellPrice: 100 },      // neutral
    { observedPrice: 100.03, buyPrice: 100, sellPrice: 100.01 },// spread boundary
    { observedPrice: 0, buyPrice: 100, sellPrice: 100 },        // invalid observed
    { observedPrice: 100, buyPrice: 100, sellPrice: 110 },      // wide spread
  ];

  it.each(cases)('matches evaluateConditions for %j', (quotes) => {
    expect(evaluateConditionsViaEngine(quotes, config)).toEqual(
      evaluateConditions(quotes, config),
    );
  });
});
