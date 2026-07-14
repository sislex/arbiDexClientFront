/**
 * Скрипт №1 — валидатор условий (автономный модуль).
 *
 * ЗОНА ОТВЕТСТВЕННОСТИ:
 *   - расчёт метрик шага (spread, % buy/sell, история for_last_steps)
 *   - проверка каждого condition → флаги true/false
 *   - формирование evaluations[] и result.condition.*
 *
 * АВТОНОМНОСТЬ: файл без import. Копируется отдельно.
 * Типы продублированы внутри файла (контракт данных).
 *
 * МЕСТО В ПАЙПЛАЙНЕ:
 *   Скрипт №3 → Скрипт №2 (фильтр окна) → Скрипт №1 (этот файл) → Decision Maker → Скрипт №3
 *
 * API: processStep(state, step, strategy, index) → StepEvalResult
 *
 * ─── ВХОД ───
 *
 * state: StrategyEngineState
 *   Начальное: createInitialEngineState()
 *
 *   StrategyEngineState {
 *     hasPosition: boolean
 *     entryPrice: number | null
 *     previousAvgPrice: number | null
 *     lastTransactionTs: number | null
 *     transactionBusyUntilTs: number | null
 *     avgObservedHigherThanBuyPercentHistory: number[]
 *     avgObservedHigherThanSellPercentHistory: number[]
 *   }
 *
 * step: MarketStep
 *
 *   MarketStep {
 *     time: number
 *     quotes: {
 *       buyQuote: number
 *       sellQuote: number
 *       avgObservedQuote: number
 *     }
 *     events?: {
 *       transaction?: TransactionEvent
 *     }
 *     balances?: {
 *       token1?: number
 *       token2?: number
 *     }
 *   }
 *
 * strategy: StrategyEngineConfig
 *
 *   StrategyEngineConfig {
 *     buy: BuyTradingConditionsConfig
 *     sell: SellTradingConditionsConfig
 *   }
 *
 *   BuyTradingConditionsConfig {
 *     enabled: boolean
 *     requireNoTransactionInProgress: boolean
 *     avgObservedHigherThanBuyPercent: number
 *     avgObservedHigherThanBuyForLastSteps: {
 *       steps: number
 *       percent: number
 *     }
 *     maxBuySellSpreadPercent: number
 *     minDelayAfterLastFinishedTransactionMs: number
 *     requireToken1Balance: boolean
 *     minToken1Balance: number
 *   }
 *
 *   SellTradingConditionsConfig {
 *     enabled: boolean
 *     requireNoTransactionInProgress: boolean
 *     avgObservedHigherThanSellPercent: number
 *     avgObservedHigherThanSellForLastSteps: {
 *       steps: number
 *       percent: number
 *     }
 *     maxBuySellSpreadPercent: number
 *     minDelayAfterLastFinishedTransactionMs: number
 *     requireToken2Balance: boolean
 *     minToken2Balance: number
 *   }
 *
 * index: number — порядковый номер шага (0, 1, 2, …)
 *
 * ─── ВЫХОД ───
 *
 * StepEvalResult {
 *   state: StrategyEngineState
 *     // обновлены history и previousAvgPrice; hasPosition — без изменений от сделки
 *   event: StrategyEngineEvent | null
 *     // action всегда "WAIT"; BUY/SELL выставляет Скрипт №3
 *   result: TradingConditionsStepResult | null
 *     // transaction.buy и transaction.sell всегда false
 * }
 *
 * EngineConditionEvaluation {
 *   id: string
 *   group: "toBuy" | "toSell"
 *   passed: boolean
 *   current?: string
 *   required?: string
 * }
 *
 * TradingConditionsStepResult.condition — флаги каждого правила:
 *   buy: { enabled, no_transaction_in_progress, avg_observed_higher_than_buy_for_last_steps, … }
 *   sell: { enabled, no_transaction_in_progress, avg_observed_higher_than_sell_for_last_steps, … }
 *
 * ─── ЗАПУСК ───
 *
 * ФРОНТ / БЭК / ТЕСТЫ:
 *   import { processStep, createInitialEngineState } from './processStep';
 *
 * ЛОКАЛЬНО (demo-processStep.ts):
 *   npx tsx demo-processStep.ts
 *
 * Полный цикл BUY/SELL — через processAllStepsAndRecordResults.ts (Скрипт №3).
 *
 * ─── ПРИМЕРЫ ТЕСТОВЫХ ДАННЫХ ───
 *
 *   const TEST_STRATEGY: StrategyEngineConfig = {
 *     buy: {
 *       enabled: true,
 *       requireNoTransactionInProgress: true,
 *       avgObservedHigherThanBuyPercent: 0,
 *       avgObservedHigherThanBuyForLastSteps: { steps: 1, percent: 0 },
 *       maxBuySellSpreadPercent: 100,
 *       minDelayAfterLastFinishedTransactionMs: 0,
 *       requireToken1Balance: false,
 *       minToken1Balance: 0,
 *     },
 *     sell: {
 *       enabled: true,
 *       requireNoTransactionInProgress: true,
 *       avgObservedHigherThanSellPercent: 0,
 *       avgObservedHigherThanSellForLastSteps: { steps: 1, percent: 0 },
 *       maxBuySellSpreadPercent: 100,
 *       minDelayAfterLastFinishedTransactionMs: 0,
 *       requireToken2Balance: false,
 *       minToken2Balance: 0,
 *     },
 *   };
 *
 *   const TEST_STRATEGY_DISABLED: StrategyEngineConfig = {
 *     buy: { ...TEST_STRATEGY.buy, enabled: false },
 *     sell: { ...TEST_STRATEGY.sell, enabled: false },
 *   };
 *
 *   const TEST_STEP: MarketStep = {
 *     time: 1_000,
 *     quotes: { buyQuote: 100, sellQuote: 101, avgObservedQuote: 102 },
 *   };
 *
 *   const TEST_STEP_TX_STARTED: MarketStep = {
 *     time: 3_000,
 *     quotes: { buyQuote: 100, sellQuote: 101, avgObservedQuote: 102 },
 *     events: {
 *       transaction: { id: "tx-1", side: "buy", status: "started" },
 *     },
 *   };
 *
 * Пример теста (Vitest) — проверяем флаги, не BUY/SELL:
 *
 *   describe('processStep', () => {
 *     it('все buy-conditions passed при мягкой стратегии', () => {
 *       const { event, result } = processStep(
 *         createInitialEngineState(), TEST_STEP, TEST_STRATEGY, 0,
 *       );
 *       expect(event?.action).toBe('WAIT');
 *       expect(result?.condition.buy.enabled).toBe(true);
 *       expect(event?.evaluations?.filter(e => e.group === 'toBuy').every(e => e.passed)).toBe(true);
 *     });
 *
 *     it('buy enabled=false при выключенной стратегии', () => {
 *       const { result } = processStep(
 *         createInitialEngineState(), TEST_STEP, TEST_STRATEGY_DISABLED, 0,
 *       );
 *       expect(result?.condition.buy.enabled).toBe(false);
 *     });
 *   });
 */

export type EngineEventAction = "BUY" | "SELL" | "WAIT" | "BLOCK_BUY" | "BLOCK_SELL";

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

export interface StrategyEngineState {
  hasPosition: boolean;
  entryPrice: number | null;
  previousAvgPrice: number | null;
  lastTransactionTs: number | null;
  transactionBusyUntilTs: number | null;
  avgObservedHigherThanBuyPercentHistory: number[];
  avgObservedHigherThanSellPercentHistory: number[];
}

export interface EngineConditionEvaluation {
  id: string;
  group: "toBuy" | "toSell";
  passed: boolean;
  current?: string;
  required?: string;
}

export interface TradingConditionsStepResult {
  transaction: {
    buy: boolean;
    sell: boolean;
    buyReaction?: TransactionEvent;
    sellReaction?: TransactionEvent;
  };
  condition: {
    buy: {
      enabled: boolean;
      no_transaction_in_progress: boolean;
      avg_observed_higher_than_buy: boolean;
      avg_observed_higher_than_buy_for_last_steps: boolean;
      spread_ok: boolean;
      last_finished_transaction_delay_ok: boolean;
      token1_balance_ok: boolean;
    };
    sell: {
      enabled: boolean;
      no_transaction_in_progress: boolean;
      avg_observed_higher_than_sell: boolean;
      avg_observed_higher_than_sell_for_last_steps: boolean;
      spread_ok: boolean;
      last_finished_transaction_delay_ok: boolean;
      token2_balance_ok: boolean;
    };
  };
  meta: {
    lastStepTime: number;
    transactionInProgress: boolean;
    lastFinishedTransactionTime: number | null;
  };
}

export interface StrategyEngineEvent {
  ts: number;
  index: number;
  action: EngineEventAction;
  message: string;
  ruleId?: string;
  conditionId?: string;
  value?: string;
  required?: string;
  price?: number;
  evaluations?: EngineConditionEvaluation[];
  result?: TradingConditionsStepResult;
}

export interface RunEngineOptions {
  initialState?: StrategyEngineState;
  includeWaitEvents?: boolean;
  waitEvery?: number;
  emit?: (event: StrategyEngineEvent) => void;
}

export interface StepEvalResult {
  state: StrategyEngineState;
  event: StrategyEngineEvent | null;
  result: TradingConditionsStepResult | null;
}

function pctDiff(current: number, base: number): number {
  if (base === 0) return 0;
  return ((current - base) / base) * 100;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(8)}%`;
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) return "0ms";
  return `${Math.max(0, value).toFixed(0)}ms`;
}

function passLastSteps(history: number[], cfg: AvgObservedHigherThanForLastStepsConfig): boolean {
  const steps = Math.max(1, Math.floor(cfg.steps));
  if (history.length < steps) return false;
  return history.slice(-steps).every(value => value >= cfg.percent);
}

export function createInitialEngineState(): StrategyEngineState {
  return {
    hasPosition: false,
    entryPrice: null,
    previousAvgPrice: null,
    lastTransactionTs: null,
    transactionBusyUntilTs: null,
    avgObservedHigherThanBuyPercentHistory: [],
    avgObservedHigherThanSellPercentHistory: [],
  };
}

export function processStep(
  inputState: StrategyEngineState,
  step: MarketStep,
  strategy: StrategyEngineConfig,
  index: number,
): StepEvalResult {
  const state: StrategyEngineState = { ...inputState };
  const avg = step.quotes.avgObservedQuote;
  const txInProgress = step.events?.transaction?.status === "started"
    || (state.transactionBusyUntilTs !== null && step.time <= state.transactionBusyUntilTs);
  const sinceLastTx = state.lastTransactionTs === null ? Number.POSITIVE_INFINITY : step.time - state.lastTransactionTs;
  const evaluations: EngineConditionEvaluation[] = [];
  const pushEval = (group: "toBuy" | "toSell", id: string, passed: boolean, current?: string, required?: string) => {
    evaluations.push({ group, id, passed, current, required });
  };
  const currentBuyPercent = pctDiff(avg, step.quotes.buyQuote);
  const currentSellPercent = pctDiff(avg, step.quotes.sellQuote);
  const currentSpreadPercent = pctDiff(step.quotes.buyQuote, step.quotes.sellQuote);

  const maxHistoryLength = Math.max(
    1,
    strategy.buy.avgObservedHigherThanBuyForLastSteps.steps,
    strategy.sell.avgObservedHigherThanSellForLastSteps.steps,
  );
  state.avgObservedHigherThanBuyPercentHistory = [...state.avgObservedHigherThanBuyPercentHistory, currentBuyPercent].slice(-maxHistoryLength);
  state.avgObservedHigherThanSellPercentHistory = [...state.avgObservedHigherThanSellPercentHistory, currentSellPercent].slice(-maxHistoryLength);

  const buyEnabled = strategy.buy.enabled;
  const buyNoTransactionInProgress = !strategy.buy.requireNoTransactionInProgress || !txInProgress;
  const buyAvgObservedHigherThanBuyForLastSteps = passLastSteps(state.avgObservedHigherThanBuyPercentHistory, strategy.buy.avgObservedHigherThanBuyForLastSteps);
  const buySpreadOk = currentSpreadPercent <= strategy.buy.maxBuySellSpreadPercent;
  const buyLastFinishedTransactionDelayOk = sinceLastTx > strategy.buy.minDelayAfterLastFinishedTransactionMs;
  const buyToken1BalanceOk = !strategy.buy.requireToken1Balance || (step.balances?.token1 ?? Number.NEGATIVE_INFINITY) >= strategy.buy.minToken1Balance;

  pushEval("toBuy", "enabled", buyEnabled);
  pushEval("toBuy", "no_transaction_in_progress", buyNoTransactionInProgress, txInProgress ? "Идет" : "Нет", "Нет текущей транзакции");
  pushEval("toBuy", "avg_observed_higher_than_buy_for_last_steps", buyAvgObservedHigherThanBuyForLastSteps, state.avgObservedHigherThanBuyPercentHistory.length.toString(), `steps=${strategy.buy.avgObservedHigherThanBuyForLastSteps.steps} percent>=${strategy.buy.avgObservedHigherThanBuyForLastSteps.percent}%`);
  pushEval("toBuy", "spread_ok", buySpreadOk, Number.isFinite(currentSpreadPercent) ? formatPercent(currentSpreadPercent) : "—", `<= ${strategy.buy.maxBuySellSpreadPercent}%`);
  pushEval("toBuy", "last_finished_transaction_delay_ok", buyLastFinishedTransactionDelayOk, formatMs(sinceLastTx), `> ${formatMs(strategy.buy.minDelayAfterLastFinishedTransactionMs)}`);
  pushEval("toBuy", "token1_balance_ok", buyToken1BalanceOk, step.balances?.token1 === undefined ? "—" : String(step.balances.token1), `>= ${strategy.buy.minToken1Balance}`);

  const sellEnabled = strategy.sell.enabled;
  const sellNoTransactionInProgress = !strategy.sell.requireNoTransactionInProgress || !txInProgress;
  const sellAvgObservedHigherThanSellForLastSteps = passLastSteps(state.avgObservedHigherThanSellPercentHistory, strategy.sell.avgObservedHigherThanSellForLastSteps);
  const sellSpreadOk = currentSpreadPercent <= strategy.sell.maxBuySellSpreadPercent;
  const sellLastFinishedTransactionDelayOk = sinceLastTx > strategy.sell.minDelayAfterLastFinishedTransactionMs;
  const sellToken2BalanceOk = !strategy.sell.requireToken2Balance || (step.balances?.token2 ?? Number.NEGATIVE_INFINITY) >= strategy.sell.minToken2Balance;

  pushEval("toSell", "enabled", sellEnabled);
  pushEval("toSell", "no_transaction_in_progress", sellNoTransactionInProgress, txInProgress ? "Идет" : "Нет", "Нет текущей транзакции");
  pushEval("toSell", "avg_observed_higher_than_sell_for_last_steps", sellAvgObservedHigherThanSellForLastSteps, state.avgObservedHigherThanSellPercentHistory.length.toString(), `steps=${strategy.sell.avgObservedHigherThanSellForLastSteps.steps} percent>=${strategy.sell.avgObservedHigherThanSellForLastSteps.percent}%`);
  pushEval("toSell", "spread_ok", sellSpreadOk, Number.isFinite(currentSpreadPercent) ? formatPercent(currentSpreadPercent) : "—", `<= ${strategy.sell.maxBuySellSpreadPercent}%`);
  pushEval("toSell", "last_finished_transaction_delay_ok", sellLastFinishedTransactionDelayOk, formatMs(sinceLastTx), `> ${formatMs(strategy.sell.minDelayAfterLastFinishedTransactionMs)}`);
  pushEval("toSell", "token2_balance_ok", sellToken2BalanceOk, step.balances?.token2 === undefined ? "—" : String(step.balances.token2), `>= ${strategy.sell.minToken2Balance}`);

  const buildConditionResult = (): TradingConditionsStepResult => ({
    transaction: (() => {
      const transaction: TradingConditionsStepResult["transaction"] = {
        buy: false,
        sell: false,
      };
      const inputTransactionEvent = step.events?.transaction;
      if (inputTransactionEvent?.side === "buy") {
        transaction.buyReaction = inputTransactionEvent;
      }
      if (inputTransactionEvent?.side === "sell") {
        transaction.sellReaction = inputTransactionEvent;
      }
      return transaction;
    })(),
    condition: {
      buy: {
        enabled: buyEnabled,
        no_transaction_in_progress: buyNoTransactionInProgress,
        avg_observed_higher_than_buy: buyAvgObservedHigherThanBuyForLastSteps,
        avg_observed_higher_than_buy_for_last_steps: buyAvgObservedHigherThanBuyForLastSteps,
        spread_ok: buySpreadOk,
        last_finished_transaction_delay_ok: buyLastFinishedTransactionDelayOk,
        token1_balance_ok: buyToken1BalanceOk,
      },
      sell: {
        enabled: sellEnabled,
        no_transaction_in_progress: sellNoTransactionInProgress,
        avg_observed_higher_than_sell: sellAvgObservedHigherThanSellForLastSteps,
        avg_observed_higher_than_sell_for_last_steps: sellAvgObservedHigherThanSellForLastSteps,
        spread_ok: sellSpreadOk,
        last_finished_transaction_delay_ok: sellLastFinishedTransactionDelayOk,
        token2_balance_ok: sellToken2BalanceOk,
      },
    },
    meta: {
      lastStepTime: step.time,
      transactionInProgress: txInProgress,
      lastFinishedTransactionTime: state.lastTransactionTs,
    },
  });

  state.previousAvgPrice = avg;
  const result = buildConditionResult();
  const conditionId = state.hasPosition ? "sell" : "buy";

  return {
    state,
    result,
    event: {
      ts: step.time,
      index,
      action: "WAIT",
      message: "Nothing",
      conditionId,
      price: avg,
      evaluations,
      result,
    },
  };
}

/** Алиас для обратной совместимости. Только валидация — без BUY/SELL. */
export const evaluateStrategyStep = processStep;
