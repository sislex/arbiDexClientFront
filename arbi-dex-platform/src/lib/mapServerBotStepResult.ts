import type { EngineConditionEvaluation } from '../simulation/engineConditionTypes'
import type {
  ServerBacktestStepRecord,
  ServerBotStepResult,
  ServerQuotePoint,
  ServerStepEngineResult,
} from '../services/botsApi'
import { eventTime } from '../simulation/simulationFormatters'
import type { SimulationEventType, SimulationLogEvent } from '../simulation/simulationViewerTypes'

import { formatEngineConditionActual, formatEngineConditionRequired } from './formatEngineConditionActual'

function mapConditionSide(
  side: Record<string, { passed: boolean; actual?: number | string; required?: number | string }>,
  group: 'toBuy' | 'toSell',
): EngineConditionEvaluation[] {
  return Object.entries(side).map(([id, outcome]) => ({
    id,
    group,
    passed: outcome.passed,
    current: formatEngineConditionActual(id, outcome.actual),
    required: formatEngineConditionRequired(id, outcome.required),
  }))
}

function decisionFromResult(result: ServerStepEngineResult): 'BUY' | 'SELL' | 'NO ACTION' {
  if (result.transaction.buy) return 'BUY'
  if (result.transaction.sell || result.transaction.forcedSell) return 'SELL'
  return 'NO ACTION'
}

function eventTypeFromResult(result: ServerStepEngineResult): SimulationEventType {
  if (result.transaction.buy) return 'Buy'
  if (result.transaction.sell || result.transaction.forcedSell) return 'Sell'
  return 'Signal'
}

function stepTimeFromRecord(record: ServerBacktestStepRecord | ServerBotStepResult): number {
  if ('step' in record && typeof record.step.time === 'number') return record.step.time
  return record.index
}

function stepQuoteFromRecord(
  record: ServerBacktestStepRecord | ServerBotStepResult,
  quote?: ServerQuotePoint,
): ServerQuotePoint | undefined {
  if (quote) return quote
  if (!('step' in record)) return undefined
  const step = record.step
  if ('buyQuote' in step) return step
  return {
    time: step.time,
    buyQuote: step.quotes.buyQuote,
    sellQuote: step.quotes.sellQuote,
    avgObservedQuote: step.quotes.avgObservedQuote,
  }
}

export function mapServerStepToLogEvent(
  record: ServerBacktestStepRecord | ServerBotStepResult,
  opts?: { quote?: ServerQuotePoint; totalSteps?: number },
): SimulationLogEvent {
  const index = record.index
  const time = stepTimeFromRecord(record)
  if ('skipped' in record && record.skipped) {
    return {
      id: `srv-step-skipped-${index}-${time}`,
      dataIdx: index,
      time: eventTime(time),
      type: 'System',
      message: 'Расчет пропущен',
      markerTs: time,
      markerPrice: record.step.avgObservedQuote > 0 ? record.step.avgObservedQuote : record.step.buyQuote,
      detail: {
        status: `${record.skipped.reason}: ${eventTime(record.skipped.range.start)} - ${eventTime(record.skipped.range.end)}`,
        stepIndex: index,
        totalSteps: record.totalSteps,
        windowSteps: record.windowSteps,
        stepTime: time,
        buyQuote: record.step.buyQuote,
        sellQuote: record.step.sellQuote,
        avgQuote: record.step.avgObservedQuote,
        transactionBuy: false,
        transactionSell: false,
        forcedSell: false,
        tookMs: record.tookMs,
        evaluations: [],
      },
    }
  }

  const result: ServerStepEngineResult =
    'result' in record
      ? record.result
      : {
          transaction: record.transaction,
          condition: record.condition,
          meta: record.meta,
        }
  const step = stepQuoteFromRecord(record, opts?.quote)
  const totalSteps = opts?.totalSteps ?? ('totalSteps' in record ? record.totalSteps : undefined)
  const decision = decisionFromResult(result)
  const evaluations = [
    ...mapConditionSide(result.condition.buy, 'toBuy'),
    ...mapConditionSide(result.condition.sell, 'toSell'),
  ]
  const markerPrice =
    decision === 'BUY'
      ? step?.buyQuote
      : decision === 'SELL'
        ? step?.sellQuote
        : step?.avgObservedQuote && step.avgObservedQuote > 0
          ? step.avgObservedQuote
          : step?.buyQuote

  return {
    id: `srv-step-${index}-${time}`,
    dataIdx: index,
    time: eventTime(time),
    type: eventTypeFromResult(result),
    message: decision === 'NO ACTION' ? 'Nothing' : decision,
    markerTs: time,
    markerPrice,
    detail: {
      decision,
      evaluations,
      stepIndex: index,
      totalSteps,
      windowSteps: 'windowSteps' in record ? record.windowSteps : undefined,
      stepTime: time,
      buyQuote: step?.buyQuote,
      sellQuote: step?.sellQuote,
      avgQuote: step?.avgObservedQuote,
      transactionBuy: result.transaction.buy,
      transactionSell: result.transaction.sell,
      forcedSell: result.transaction.forcedSell,
      tookMs: 'tookMs' in record ? record.tookMs : undefined,
    },
  }
}

export function mapServerTradeToLogEvent(trade: {
  id: string
  time: number
  side: 'buy' | 'sell'
  price: number
  amount: number
  pnl?: number
  reason?: string
  status?: 'success' | 'failed'
  error?: string | null
}, dataIdx: number, markerTs?: number): SimulationLogEvent {
  const ts = markerTs ?? trade.time
  const isFailed = trade.status === 'failed'
  return {
    id: `srv-trade-${trade.id}`,
    dataIdx,
    time: eventTime(trade.time),
    type: isFailed ? 'Error' : trade.side === 'buy' ? 'Buy' : 'Sell',
    message: isFailed ? (trade.error ?? 'Сделка не прошла') : (trade.reason ?? trade.side.toUpperCase()),
    detail: {
      decision: trade.side === 'buy' ? 'BUY' : 'SELL',
      currentValue: String(trade.price),
      amount: `${trade.amount.toFixed(4)}`,
      status: isFailed ? 'failed' : 'success',
    },
    markerTs: ts,
    markerPrice: trade.price,
  }
}

export function mapServerLiveTradeToLogEvent(
  trade: {
    id: string
    time: number
    side: 'buy' | 'sell'
    status: 'success' | 'failed'
    price: number | null
    expectedPrice: number | null
    amountIn: number
    pnl?: number | null
    error?: string | null
  },
  quotes: ServerQuotePoint[],
): SimulationLogEvent {
  const idx = findQuoteIndexByTime(quotes, trade.time)
  const quote = quotes[idx] ?? quotes[quotes.length - 1]
  const markerTs = quote?.time ?? trade.time
  const markerPrice =
    trade.price ??
    trade.expectedPrice ??
    (trade.side === 'buy' ? quote?.buyQuote : quote?.sellQuote) ??
    0
  return mapServerTradeToLogEvent(
    {
      id: trade.id,
      time: trade.time,
      side: trade.side,
      price: markerPrice,
      amount: trade.amountIn,
      pnl: trade.pnl ?? undefined,
      status: trade.status,
      error: trade.error,
    },
    idx,
    markerTs,
  )
}

function findQuoteIndexByTime(quotes: ServerQuotePoint[], time: number): number {
  if (quotes.length === 0) return 0
  let idx = quotes.findIndex((q) => q.time >= time)
  if (idx < 0) return quotes.length - 1
  return idx
}
