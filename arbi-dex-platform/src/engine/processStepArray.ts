/**
 * Скрипт №2 — фильтрация окна шагов (автономный модуль).
 *
 * ЗОНА ОТВЕТСТВЕННОСТИ:
 *   - принять полный массив шагов от Скрипта №3
 *   - вычислить нужный размер окна по strategy (for_last_steps)
 *   - вернуть хвост массива для проверки conditions
 *
 * АВТОНОМНОСТЬ: файл без import. Копируется отдельно.
 *
 * МЕСТО В ПАЙПЛАЙНЕ:
 *   Скрипт №3 → этот файл (filter) → Скрипт №1 → Decision Maker → Скрипт №3
 *
 * API:
 *   getRequiredWindowSize(strategy) → number
 *   processStepArray(steps, strategy, options?) → ProcessStepArrayOutput
 *
 * ─── ЛОГИКА ОКНА ───
 *
 * windowSize = max(
 *   buy.avgObservedHigherThanBuyForLastSteps.steps,
 *   sell.avgObservedHigherThanSellForLastSteps.steps,
 * )
 *
 * Примеры из стратегии:
 *   - «Количество шагов для проверки покупки: 5»
 *   - «Количество шагов для проверки продажи: 5»
 *   → windowSize = 5 (берётся большее)
 *
 * Если истории меньше windowSize — возвращается всё доступное.
 * Правила задержки (60000 ms после транзакции) проверяет Скрипт №1, не этот файл.
 *
 * ─── ВХОД ───
 *
 * steps: MarketStep[]
 *
 *   MarketStep {
 *     time: number
 *     quotes: {
 *       buyQuote: number
 *       sellQuote: number
 *       avgObservedQuote: number
 *     }
 *     events?: { transaction?: TransactionEvent }
 *     balances?: { token1?: number, token2?: number }
 *   }
 *
 * strategy: StrategyEngineConfig
 *
 *   StrategyEngineConfig {
 *     buy: BuyTradingConditionsConfig
 *     sell: SellTradingConditionsConfig
 *   }
 *
 * options?: ProcessStepArrayOptions {
 *   currentIndex?: number   // default: steps.length - 1
 * }
 *
 * ─── ВЫХОД ───
 *
 * ProcessStepArrayOutput {
 *   filteredSteps: MarketStep[]
 *   windowStartIndex: number
 *   windowSize: number
 * }
 *
 * ─── ЗАПУСК ───
 *
 *   import { processStepArray, getRequiredWindowSize } from './processStepArray';
 *
 * ЛОКАЛЬНО (demo-processStepArray.ts):
 *
 *   const out = processStepArray(TEST_STEPS, TEST_STRATEGY, { currentIndex: 2 });
 *   console.log(out.filteredSteps.length, out.windowStartIndex);
 *
 *   npx tsx demo-processStepArray.ts
 *
 * ─── ПРИМЕРЫ ТЕСТОВЫХ ДАННЫХ ───
 *
 *   const TEST_STRATEGY_WINDOW_5: StrategyEngineConfig = {
 *     buy: {
 *       enabled: true,
 *       requireNoTransactionInProgress: true,
 *       avgObservedHigherThanBuyPercent: 0,
 *       avgObservedHigherThanBuyForLastSteps: { steps: 5, percent: 0 },
 *       maxBuySellSpreadPercent: 100,
 *       minDelayAfterLastFinishedTransactionMs: 60_000,
 *       requireToken1Balance: false,
 *       minToken1Balance: 0,
 *     },
 *     sell: {
 *       enabled: true,
 *       requireNoTransactionInProgress: true,
 *       avgObservedHigherThanSellPercent: 0,
 *       avgObservedHigherThanSellForLastSteps: { steps: 3, percent: 0 },
 *       maxBuySellSpreadPercent: 100,
 *       minDelayAfterLastFinishedTransactionMs: 60_000,
 *       requireToken2Balance: false,
 *       minToken2Balance: 0,
 *     },
 *   };
 *
 *   const TEST_STEPS: MarketStep[] = [
 *     { time: 1_000, quotes: { buyQuote: 100, sellQuote: 101, avgObservedQuote: 102 } },
 *     { time: 2_000, quotes: { buyQuote: 100, sellQuote: 101, avgObservedQuote: 102 } },
 *     { time: 3_000, quotes: { buyQuote: 100, sellQuote: 101, avgObservedQuote: 102 } },
 *   ];
 *
 * Пример теста (Vitest):
 *
 *   describe('processStepArray', () => {
 *     it('windowSize = max(buy.steps, sell.steps)', () => {
 *       expect(getRequiredWindowSize(TEST_STRATEGY_WINDOW_5)).toBe(5);
 *     });
 *
 *     it('при currentIndex=2 и steps=3 возвращает все 3 шага', () => {
 *       const out = processStepArray(TEST_STEPS, TEST_STRATEGY_WINDOW_5, { currentIndex: 2 });
 *       expect(out.windowSize).toBe(3);
 *       expect(out.windowStartIndex).toBe(0);
 *       expect(out.filteredSteps).toHaveLength(3);
 *     });
 *   });
 */

export interface AvgObservedHigherThanForLastStepsConfig {
  steps: number;
  percent: number;
}

export interface BuyTradingConditionsConfig {
  enabled: boolean;
  requireNoTransactionInProgress: boolean;
  avgObservedHigherThanBuyPercent: number;
  avgObservedHigherThanBuyForLastSteps: AvgObservedHigherThanForLastStepsConfig;
  maxBuySellSpreadPercent: number;
  minDelayAfterLastFinishedTransactionMs: number;
  requireToken1Balance: boolean;
  minToken1Balance: number;
}

export interface SellTradingConditionsConfig {
  enabled: boolean;
  requireNoTransactionInProgress: boolean;
  avgObservedHigherThanSellPercent: number;
  avgObservedHigherThanSellForLastSteps: AvgObservedHigherThanForLastStepsConfig;
  maxBuySellSpreadPercent: number;
  minDelayAfterLastFinishedTransactionMs: number;
  requireToken2Balance: boolean;
  minToken2Balance: number;
}

export interface StrategyEngineConfig {
  buy: BuyTradingConditionsConfig;
  sell: SellTradingConditionsConfig;
}

export interface TransactionEvent {
  id: string;
  side: "buy" | "sell";
  status: "started" | "finished" | "failed";
  txHash?: string;
  error?: string;
}

export interface MarketStep {
  time: number;
  quotes: {
    buyQuote: number;
    sellQuote: number;
    avgObservedQuote: number;
  };
  events?: {
    transaction?: TransactionEvent;
  };
  balances?: {
    token1?: number;
    token2?: number;
  };
}

export interface ProcessStepArrayOptions {
  currentIndex?: number;
}

export interface ProcessStepArrayOutput {
  filteredSteps: MarketStep[];
  windowStartIndex: number;
  windowSize: number;
}

/** @deprecated Используйте ProcessStepArrayOptions. */
export type RunEngineOptions = ProcessStepArrayOptions;

export function getRequiredWindowSize(strategy: StrategyEngineConfig): number {
  const buySteps = Math.max(1, Math.floor(strategy.buy.avgObservedHigherThanBuyForLastSteps.steps));
  const sellSteps = Math.max(1, Math.floor(strategy.sell.avgObservedHigherThanSellForLastSteps.steps));
  return Math.max(buySteps, sellSteps);
}

export function processStepArray(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
  options: ProcessStepArrayOptions = {},
): ProcessStepArrayOutput {
  if (steps.length === 0) {
    return { filteredSteps: [], windowStartIndex: 0, windowSize: 0 };
  }

  const currentIndex = options.currentIndex ?? steps.length - 1;
  const safeIndex = Math.max(0, Math.min(currentIndex, steps.length - 1));
  const requiredWindow = getRequiredWindowSize(strategy);
  const available = safeIndex + 1;
  const windowSize = Math.min(requiredWindow, available);
  const windowStartIndex = safeIndex + 1 - windowSize;

  return {
    filteredSteps: steps.slice(windowStartIndex, safeIndex + 1),
    windowStartIndex,
    windowSize,
  };
}
