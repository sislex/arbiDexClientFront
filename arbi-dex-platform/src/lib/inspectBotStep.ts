import type {
  ServerBacktestStepRecord,
  ServerQuotePoint,
} from '../services/botsApi'
import { mapServerStepToLogEvent } from './mapServerBotStepResult'
import type { SimulationLogEvent } from '../simulation/simulationViewerTypes'

export function findNearestStepRecord(
  records: ServerBacktestStepRecord[],
  time: number,
): ServerBacktestStepRecord {
  let rec = records[0]
  for (const r of records) {
    const stepTime = r.step.time
    if (stepTime <= time && stepTime >= rec.step.time) rec = r
  }
  return rec
}

export function findQuoteIndexByTime(quotes: ServerQuotePoint[], time: number): number {
  let idx = quotes.findIndex((q) => q.time >= time)
  if (idx < 0) return Math.max(0, quotes.length - 1)
  return idx
}

export function buildStepLogEventFromBacktestRecord(
  record: ServerBacktestStepRecord,
  quotes: ServerQuotePoint[],
  totalSteps: number,
): SimulationLogEvent {
  const quote = quotes[record.index] ?? quotes[quotes.length - 1]
  return mapServerStepToLogEvent(record, { quote, totalSteps })
}
