/**
 * Мост от бэктеста к общему движку стратегии (`processStep` из
 * @sislex/arbi-conditions-libs).
 *
 * Оценка условий шага теперь идёт через движок: каждое аналитическое условие
 * выражается как `ConditionDef` (переиспользуя те же формулы из
 * `CONDITION_EVALUATORS`), `processStep` их агрегирует, а мы маппим per-condition
 * результаты обратно в `ConditionResult[]`, который уже потребляет бэктест.
 *
 * Поведение сохраняется 1:1 — формулы и пороги те же. Отдельный слой решения
 * (`decideAction`) и симуляция сделок остаются без изменений.
 */

import { processStep } from '@sislex/arbi-conditions-libs';
import type {
  ConditionDef,
  MarketStep,
  StrategyEngineConfig,
} from '@sislex/arbi-conditions-libs';
import {
  CONDITION_EVALUATORS,
  type AnalyticsConditionsConfig,
  type ConditionResult,
  type StepQuotes,
} from './trade-analytics.helper';

/**
 * `processStep` требует объект стратегии, но встроенные условия движка здесь не
 * используются (мы передаём свои `conditions`, читающие пороги из конфига
 * аналитики). Поэтому стратегия максимально «пропускающая».
 */
const PERMISSIVE_STRATEGY: StrategyEngineConfig = {
  buy: {
    enabled: true,
    requireNoTransactionInProgress: false,
    avgObservedHigherThanBuyPercent: 0,
    avgObservedHigherThanBuyForLastSteps: { steps: 1, percent: 0 },
    maxBuySellSpreadPercent: Number.POSITIVE_INFINITY,
    minDelayAfterLastFinishedTransactionMs: 0,
    requireToken1Balance: false,
    minToken1Balance: 0,
  },
  sell: {
    enabled: true,
    requireNoTransactionInProgress: false,
    avgObservedHigherThanSellPercent: 0,
    avgObservedHigherThanSellForLastSteps: { steps: 1, percent: 0 },
    maxBuySellSpreadPercent: Number.POSITIVE_INFINITY,
    minDelayAfterLastFinishedTransactionMs: 0,
    requireToken2Balance: false,
    minToken2Balance: 0,
  },
};

/** Котировки шага → MarketStep движка. */
export function quotesToMarketStep(quotes: StepQuotes, time = 0): MarketStep {
  return {
    time,
    quotes: {
      buyQuote: quotes.buyPrice,
      sellQuote: quotes.sellPrice,
      avgObservedQuote: quotes.observedPrice,
    },
  };
}

/** Каждое включённое аналитическое условие → engine-условие (ConditionDef). */
export function buildEngineConditions(config: AnalyticsConditionsConfig): ConditionDef[] {
  return config.conditions
    .filter((def) => def.enabled !== false)
    .map((def) => ({
      id: def.id,
      window: () => ({}),
      evaluate: (ctx) => {
        const quotes: StepQuotes = {
          observedPrice: ctx.current.quotes.avgObservedQuote,
          buyPrice: ctx.current.quotes.buyQuote,
          sellPrice: ctx.current.quotes.sellQuote,
        };
        const evaluator = CONDITION_EVALUATORS[def.type];
        if (!evaluator) {
          return { passed: false, actual: 0, required: def.thresholdPct };
        }
        const { passed, actualPct } = evaluator(quotes, def.thresholdPct);
        return { passed, actual: actualPct, required: def.thresholdPct };
      },
    }));
}

/**
 * Drop-in для `evaluateConditions`: прогоняет шаг через `processStep` и
 * возвращает тот же `ConditionResult[]`. Условия здесь side-agnostic, поэтому
 * читаем результаты со стороны buy.
 */
export function evaluateConditionsViaEngine(
  quotes: StepQuotes,
  config: AnalyticsConditionsConfig,
): ConditionResult[] {
  const result = processStep({
    steps: [quotesToMarketStep(quotes)],
    strategy: PERMISSIVE_STRATEGY,
    conditions: buildEngineConditions(config),
  });
  const outcomes = result.condition.buy;

  return config.conditions
    .filter((def) => def.enabled !== false)
    .map((def) => {
      const outcome = outcomes[def.id];
      return {
        id: def.id,
        type: def.type,
        passed: outcome?.passed ?? false,
        thresholdPct: def.thresholdPct,
        actualPct: typeof outcome?.actual === 'number' ? outcome.actual : 0,
        description: def.description,
      };
    });
}
