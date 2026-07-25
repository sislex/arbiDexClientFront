import { getCatalogEntry, getConditionTitle } from '../lib/conditionsCatalog'
import type { SimulationLogEvent } from './simulationViewerTypes'

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

function humanizeIdentifier(value: string): string {
  const words = value
    .replace(/([a-zа-я])([A-ZА-Я])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!words) return value
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function getEventTitle(event: SimulationLogEvent): string {
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

