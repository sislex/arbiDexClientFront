/**
 * Скрипт №3 — главный диспетчер и исполнитель.
 *
 * ЗОНА ОТВЕТСТВЕННОСТИ:
 *   - точка входа: все шаги массива/потока
 *   - оркестрация Скрипт №2 → №1 → resolveBuySellDecision
 *   - применение BUY/SELL к state (hasPosition, entryPrice, …)
 *   - sendTradeRequest → перезапись step.events.transaction в массиве
 *   - сборка StrategyEngineEvent и records
 *
 * АВТОНОМНОСТЬ:
 *   Этот файл import-ит три модуля выше. Для переноса скопируйте папку целиком:
 *     processStep.ts
 *     processStepArray.ts
 *     resolveBuySellDecision.ts
 *     processAllStepsAndRecordResults.ts
 *
 * МЕСТО В ПРИЛОЖЕНИИ:
 *   StrategyDetails → dispatchStrategyStepSync / runStrategyStepsSync
 *
 * ─── ПОТОК НА КАЖДОМ ШАГЕ ───
 *
 *   1. processStepArray(allSteps, strategy, { currentIndex })
 *   2. processStep(state, step, strategy, index)
 *   3. resolveBuySellDecision(state.hasPosition, evaluations)
 *   4. если BUY|SELL → applyTradeDecision + sendTradeRequest? → merge step
 *   5. event action: NONE → WAIT, BUY/SELL → соответствующий action
 *
 * ─── API ───
 *
 *   processAllStepsAndRecordResults(steps, strategy, options?)  — async, с бэком
 *   processAllStepsAndRecordResultsSync(steps, strategy, options?) — sync
 *   dispatchStrategyStepSync(allSteps, index, state, strategy)   — один шаг
 *   runStrategyStepsSync(steps, strategy, options?)              — только events
 *
 * ─── ВХОД ───
 *
 * steps: MarketStep[]
 * strategy: StrategyEngineConfig
 *
 * ProcessAllStepsAndRecordResultsOptions {
 *   initialState?: StrategyEngineState
 *   includeWaitEvents?: boolean          // default: true
 *   waitEvery?: number                   // default: 1
 *   onRecord?: (record) => void
 *   sendTradeRequest?: (params) => TransactionEvent | Promise<TransactionEvent>
 *   onStepUpdated?: ({ index, step }) => void
 * }
 *
 * sendTradeRequest params {
 *   action: "BUY" | "SELL"
 *   step: MarketStep
 *   index: number
 * }
 *
 * ─── ВЫХОД ───
 *
 * ProcessAllStepsAndRecordResultsOutput {
 *   finalState: StrategyEngineState
 *   events: StrategyEngineEvent[]
 *   records: Array<{
 *     index: number
 *     step: MarketStep
 *     event: StrategyEngineEvent | null
 *     result: TradingConditionsStepResult | null
 *   }>
 *   steps: MarketStep[]   // с перезаписанными transaction после бэка
 * }
 *
 * DispatchStrategyStepOutput {
 *   state: StrategyEngineState
 *   event: StrategyEngineEvent | null
 *   result: TradingConditionsStepResult | null
 *   step: MarketStep
 *   filteredWindow: ProcessStepArrayOutput
 *   decision: BuySellDecision
 * }
 *
 * ─── ЗАПУСК ───
 *
 * ФРОНТ (этот проект):
 *   import {
 *     processAllStepsAndRecordResultsSync,
 *     dispatchStrategyStepSync,
 *     runStrategyStepsSync,
 *   } from '../../shared/step scripts/processAllStepsAndRecordResults';
 *
 * БЭК с запросами:
 *   await processAllStepsAndRecordResults(steps, strategy, {
 *     sendTradeRequest: async ({ action, step, index }) => ({
 *       id: `tx-${index}`,
 *       side: action === 'BUY' ? 'buy' : 'sell',
 *       status: 'finished',
 *     }),
 *   });
 *
 * ─── ПРИМЕРЫ ТЕСТОВЫХ ДАННЫХ ───
 *
 *   const TEST_STEPS: MarketStep[] = [
 *     { time: 1_000, quotes: { buyQuote: 100, sellQuote: 101, avgObservedQuote: 102 } },
 *     { time: 15_000, quotes: { buyQuote: 100, sellQuote: 101, avgObservedQuote: 102 } },
 *   ];
 *
 *   // strategy — см. TEST_STRATEGY в processStep.ts
 *
 * Пример теста (Vitest):
 *
 *   describe('processAllStepsAndRecordResultsSync', () => {
 *     it('BUY на первом шаге, SELL на втором', () => {
 *       const output = processAllStepsAndRecordResultsSync(TEST_STEPS, TEST_STRATEGY, {
 *         includeWaitEvents: false,
 *       });
 *       expect(output.events.map(e => e.action)).toEqual(['BUY', 'SELL']);
 *       expect(output.finalState.hasPosition).toBe(false);
 *     });
 *   });
 */

import {
  createInitialEngineState,
  processStep,
  type EngineConditionEvaluation,
  type MarketStep,
  type StrategyEngineConfig,
  type StrategyEngineEvent,
  type StrategyEngineState,
  type TradingConditionsStepResult,
  type TransactionEvent,
} from "./processStep";
import { processStepArray } from "./processStepArray";
import { resolveBuySellDecision, type BuySellDecision } from "./resolveBuySellDecision";

export type {
  AvgObservedHigherThanForLastStepsConfig,
  BuyTradingConditionsConfig,
  EngineConditionEvaluation,
  EngineEventAction,
  MarketStep,
  RunEngineOptions,
  SellTradingConditionsConfig,
  StepEvalResult,
  StrategyEngineConfig,
  StrategyEngineEvent,
  StrategyEngineState,
  TradingConditionsStepResult,
  TransactionEvent,
} from "./processStep";

export { createInitialEngineState, processStep } from "./processStep";
export { processStepArray, getRequiredWindowSize } from "./processStepArray";
export { resolveBuySellDecision, type BuySellDecision } from "./resolveBuySellDecision";

const DEFAULT_TX_MS = 5000;

export interface ProcessAllStepsAndRecordResultsOptions {
  initialState?: StrategyEngineState;
  includeWaitEvents?: boolean;
  waitEvery?: number;
  onRecord?: (record: {
    index: number;
    step: MarketStep;
    event: StrategyEngineEvent | null;
    result: TradingConditionsStepResult | null;
  }) => void;
  /** Отправка BUY/SELL запроса на бэк. Возвращает transaction для перезаписи шага. */
  sendTradeRequest?: (params: {
    action: Exclude<BuySellDecision, "NONE">;
    step: MarketStep;
    index: number;
  }) => TransactionEvent | Promise<TransactionEvent>;
  /** Колбэк после перезаписи шага в массиве (ответ бэка). */
  onStepUpdated?: (params: { index: number; step: MarketStep }) => void;
}

export interface ProcessAllStepsAndRecordResultsOutput {
  finalState: StrategyEngineState;
  events: StrategyEngineEvent[];
  records: Array<{
    index: number;
    step: MarketStep;
    event: StrategyEngineEvent | null;
    result: TradingConditionsStepResult | null;
  }>;
  /** Массив шагов с перезаписанными transaction после ответов бэка. */
  steps: MarketStep[];
}

function applyTradeDecision(
  state: StrategyEngineState,
  decision: Exclude<BuySellDecision, "NONE">,
  step: MarketStep,
): StrategyEngineState {
  const avg = step.quotes.avgObservedQuote;
  if (decision === "BUY") {
    return {
      ...state,
      hasPosition: true,
      entryPrice: avg,
      lastTransactionTs: step.time,
      transactionBusyUntilTs: step.time + DEFAULT_TX_MS,
      previousAvgPrice: avg,
    };
  }
  return {
    ...state,
    hasPosition: false,
    entryPrice: null,
    lastTransactionTs: step.time,
    transactionBusyUntilTs: step.time + DEFAULT_TX_MS,
    previousAvgPrice: avg,
  };
}

function mergeTransactionIntoStep(step: MarketStep, transaction: TransactionEvent): MarketStep {
  return {
    ...step,
    events: {
      ...step.events,
      transaction,
    },
  };
}

function buildTradeResult(
  validationResult: TradingConditionsStepResult,
  decision: Exclude<BuySellDecision, "NONE">,
  transaction?: TransactionEvent,
): TradingConditionsStepResult {
  const baseTx = validationResult.transaction;
  return {
    ...validationResult,
    transaction: {
      buy: decision === "BUY",
      sell: decision === "SELL",
      buyReaction: decision === "BUY"
        ? (transaction ?? baseTx.buyReaction)
        : baseTx.buyReaction,
      sellReaction: decision === "SELL"
        ? (transaction ?? baseTx.sellReaction)
        : baseTx.sellReaction,
    },
  };
}

function buildDispatchedEvent(
  validationEvent: StrategyEngineEvent,
  decision: BuySellDecision,
  result: TradingConditionsStepResult,
): StrategyEngineEvent {
  if (decision === "NONE") {
    return { ...validationEvent, result };
  }
  return {
    ...validationEvent,
    action: decision,
    message: decision,
    conditionId: decision === "BUY" ? "buy" : "sell",
    result,
  };
}

export interface DispatchStrategyStepOutput {
  state: StrategyEngineState;
  event: StrategyEngineEvent | null;
  result: TradingConditionsStepResult | null;
  step: MarketStep;
  filteredWindow: ReturnType<typeof processStepArray>;
  decision: BuySellDecision;
}

/** Диспетчер одного шага — для пошагового playback в UI. */
export async function dispatchStrategyStep(
  allSteps: MarketStep[],
  index: number,
  state: StrategyEngineState,
  strategy: StrategyEngineConfig,
  options: Pick<ProcessAllStepsAndRecordResultsOptions, "sendTradeRequest" | "onStepUpdated"> = {},
): Promise<DispatchStrategyStepOutput> {
  const filteredWindow = processStepArray(allSteps, strategy, { currentIndex: index });
  let step = allSteps[index];
  if (!step) {
    return {
      state,
      event: null,
      result: null,
      step: { time: 0, quotes: { buyQuote: 0, sellQuote: 0, avgObservedQuote: 0 } },
      filteredWindow,
      decision: "NONE",
    };
  }

  const validation = processStep(state, step, strategy, index);
  const evaluations: EngineConditionEvaluation[] = validation.event?.evaluations ?? [];
  const decision = resolveBuySellDecision(state.hasPosition, evaluations);

  let nextState = validation.state;
  let result = validation.result;
  let event = validation.event;

  if (decision !== "NONE" && result && event) {
    nextState = applyTradeDecision(state, decision, step);
    let transaction: TransactionEvent | undefined;
    if (options.sendTradeRequest) {
      const response = await options.sendTradeRequest({ action: decision, step, index });
      transaction = response;
      step = mergeTransactionIntoStep(step, response);
      allSteps[index] = step;
      options.onStepUpdated?.({ index, step });
    }
    result = buildTradeResult(result, decision, transaction);
    event = buildDispatchedEvent(event, decision, result);
  }

  return {
    state: nextState,
    event,
    result,
    step,
    filteredWindow,
    decision,
  };
}

/** Синхронная версия dispatchStrategyStep без sendTradeRequest. */
export function dispatchStrategyStepSync(
  allSteps: MarketStep[],
  index: number,
  state: StrategyEngineState,
  strategy: StrategyEngineConfig,
): DispatchStrategyStepOutput {
  const filteredWindow = processStepArray(allSteps, strategy, { currentIndex: index });
  const step = allSteps[index];
  if (!step) {
    return {
      state,
      event: null,
      result: null,
      step: { time: 0, quotes: { buyQuote: 0, sellQuote: 0, avgObservedQuote: 0 } },
      filteredWindow,
      decision: "NONE",
    };
  }

  const validation = processStep(state, step, strategy, index);
  const evaluations: EngineConditionEvaluation[] = validation.event?.evaluations ?? [];
  const decision = resolveBuySellDecision(state.hasPosition, evaluations);

  let nextState = validation.state;
  let result = validation.result;
  let event = validation.event;

  if (decision !== "NONE" && result && event) {
    nextState = applyTradeDecision(state, decision, step);
    result = buildTradeResult(result, decision);
    event = buildDispatchedEvent(event, decision, result);
  }

  return {
    state: nextState,
    event,
    result,
    step,
    filteredWindow,
    decision,
  };
}

export async function processAllStepsAndRecordResults(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
  options: ProcessAllStepsAndRecordResultsOptions = {},
): Promise<ProcessAllStepsAndRecordResultsOutput> {
  const workingSteps = steps.map(step => ({ ...step }));
  let state = options.initialState ?? createInitialEngineState();
  const includeWaitEvents = options.includeWaitEvents ?? true;
  const waitEvery = Math.max(1, options.waitEvery ?? 1);
  const events: StrategyEngineEvent[] = [];
  const records: ProcessAllStepsAndRecordResultsOutput["records"] = [];

  for (let index = 0; index < workingSteps.length; index += 1) {
    const dispatched = options.sendTradeRequest
      ? await dispatchStrategyStep(workingSteps, index, state, strategy, options)
      : dispatchStrategyStepSync(workingSteps, index, state, strategy);

    state = dispatched.state;
    const { event, result, step } = dispatched;

    const record = { index, step, event, result };
    records.push(record);
    options.onRecord?.(record);

    if (!event) continue;
    const shouldEmitWait = event.action !== "WAIT" || (includeWaitEvents && index % waitEvery === 0);
    if (shouldEmitWait) events.push(event);
  }

  return {
    finalState: state,
    events,
    records,
    steps: workingSteps,
  };
}

/** Синхронный прогон без sendTradeRequest (playback, историческая симуляция). */
export function processAllStepsAndRecordResultsSync(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
  options: Omit<ProcessAllStepsAndRecordResultsOptions, "sendTradeRequest" | "onStepUpdated"> = {},
): ProcessAllStepsAndRecordResultsOutput {
  const workingSteps = steps.map(step => ({ ...step }));
  let state = options.initialState ?? createInitialEngineState();
  const includeWaitEvents = options.includeWaitEvents ?? true;
  const waitEvery = Math.max(1, options.waitEvery ?? 1);
  const events: StrategyEngineEvent[] = [];
  const records: ProcessAllStepsAndRecordResultsOutput["records"] = [];

  for (let index = 0; index < workingSteps.length; index += 1) {
    const dispatched = dispatchStrategyStepSync(workingSteps, index, state, strategy);
    state = dispatched.state;
    const { event, result, step } = dispatched;

    const record = { index, step, event, result };
    records.push(record);
    options.onRecord?.(record);

    if (!event) continue;
    const shouldEmitWait = event.action !== "WAIT" || (includeWaitEvents && index % waitEvery === 0);
    if (shouldEmitWait) events.push(event);
  }

  return { finalState: state, events, records, steps: workingSteps };
}

export function runStrategyStepsSync(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
  options: Omit<ProcessAllStepsAndRecordResultsOptions, "sendTradeRequest" | "onStepUpdated"> = {},
): StrategyEngineEvent[] {
  return processAllStepsAndRecordResultsSync(steps, strategy, options).events;
}

export async function runStrategySteps(
  steps: MarketStep[],
  strategy: StrategyEngineConfig,
  options: ProcessAllStepsAndRecordResultsOptions = {},
): Promise<StrategyEngineEvent[]> {
  const output = await processAllStepsAndRecordResults(steps, strategy, options);
  return output.events;
}
