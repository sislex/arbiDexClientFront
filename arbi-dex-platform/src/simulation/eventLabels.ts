import { getCatalogEntry, getConditionTitle } from '../lib/conditionsCatalog'
import type { SimulationLogEvent } from './simulationViewerTypes'

/** Sell TRIGGER condition ids that drive `transaction.forcedSell`. */
export const FORCED_SELL_TRIGGER_IDS = [
  'stop_loss',
  'trailing_take_profit',
  'max_holding_time',
] as const

export type ForcedSellTriggerId = (typeof FORCED_SELL_TRIGGER_IDS)[number]

const FORCED_SELL_TRIGGER_SET = new Set<string>(FORCED_SELL_TRIGGER_IDS)

const EVENT_TITLES: Record<string, string> = {
  Nothing: 'Нет торгового сигнала',
  'NO ACTION': 'Нет торгового сигнала',
  BUY: 'Сигнал на покупку',
  SELL: 'Сигнал на продажу',
  'BUY REQUEST': 'Запрос на покупку',
  'SELL REQUEST': 'Запрос на продажу',
  'BUY FILLED': 'Покупка исполнена',
  'SELL FILLED': 'Продажа исполнена',
  'BUY ERROR': 'Ошибка покупки',
  'SELL ERROR': 'Ошибка продажи',
  ERROR: 'Ошибка исполнения',
}

const RULE_TITLES: Record<string, string> = {
  buy: 'Условия покупки',
  sell: 'Условия продажи',
}

const FORCED_SELL_REASON_LABELS: Record<string, string> = {
  stop_loss: 'стоп-лосс',
  trailing_take_profit: 'take-profit',
  max_holding_time: 'макс. время удержания',
}

function humanizeIdentifier(value: string): string {
  const words = value
    .replace(/([a-zа-я])([A-ZА-Я])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!words) return value
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function isForcedSellTriggerId(id: string): boolean {
  return FORCED_SELL_TRIGGER_SET.has(id)
}

/** Parse engine trade `reason` like `stop_loss` or `stop_loss, sell`. */
export function parseForcedSellReasonsFromTradeReason(reason?: string | null): string[] {
  if (!reason) return []
  return reason
    .split(',')
    .map((part) => part.trim())
    .filter((part) => isForcedSellTriggerId(part))
}

export function formatForcedSellReasonLabel(id: string): string {
  return FORCED_SELL_REASON_LABELS[id] ?? getConditionTitle(id).toLowerCase()
}

export function formatForcedSellTitle(reasons: string[]): string {
  const unique = [...new Set(reasons.filter(Boolean))]
  if (unique.length === 0) return 'Принудительная продажа'
  return `Принудительная продажа: ${unique.map(formatForcedSellReasonLabel).join(', ')}`
}

export function getEventTitle(event: SimulationLogEvent): string {
  const forcedReasons =
    event.detail?.forcedSellReasons?.filter(Boolean) ??
    parseForcedSellReasonsFromTradeReason(event.message)

  if (event.detail?.forcedSell || forcedReasons.length > 0) {
    return formatForcedSellTitle(forcedReasons)
  }

  const direct = EVENT_TITLES[event.message]
  if (direct) return direct
  if (getCatalogEntry(event.message)) return getConditionTitle(event.message)
  if (/^[a-z][a-z0-9_-]*$/i.test(event.message) && /[_-]/.test(event.message)) {
    return humanizeIdentifier(event.message)
  }
  return event.message
}

export function getRuleTitle(rule: string): string {
  return RULE_TITLES[rule] ?? getConditionTitle(rule)
}

export function getDecisionTitle(decision: string): string {
  return EVENT_TITLES[decision] ?? humanizeIdentifier(decision)
}
