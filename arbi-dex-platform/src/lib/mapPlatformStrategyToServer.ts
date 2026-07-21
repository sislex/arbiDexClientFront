import { createDefaultTradingRules, getRuleDefinition } from '../data/tradingRulesDefaults'
import { getStrategyRulesForId } from './strategyRulesStorage'
import type { StrategyDefaults } from '../services/configApi'
import type { TradingRuleState } from '../types/tradingRules'

type ServerCondition = {
  conditionId: string
  enabled: boolean
  params: Record<string, number | boolean>
  tuneRanges?: Record<string, unknown>
}

function cloneDefaults(defaults: StrategyDefaults, side: 'buy' | 'sell'): ServerCondition[] {
  return (defaults[side] as ServerCondition[]).map((item) => ({
    ...item,
    params: { ...item.params },
    tuneRanges: item.tuneRanges ? { ...item.tuneRanges } : undefined,
  }))
}

function findCondition(conditions: ServerCondition[], conditionId: string): ServerCondition | undefined {
  return conditions.find((item) => item.conditionId === conditionId)
}

function ruleEnabled(rules: TradingRuleState[], ruleId: string, fallback = true): boolean {
  const rule = rules.find((item) => item.id === ruleId)
  return rule?.enabled ?? fallback
}

function ruleNumber(rules: TradingRuleState[], ruleId: string, param: string, fallback: number): number {
  const rule = rules.find((item) => item.id === ruleId)
  const raw = rule?.values[param]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  const def = getRuleDefinition(ruleId)
  const fromDefault = def?.defaults[param]
  return typeof fromDefault === 'number' ? fromDefault : fallback
}

function applyBuyRules(conditions: ServerCondition[], rules: TradingRuleState[]) {
  const avg = findCondition(conditions, 'avg_observed_higher_for_last_steps')
  if (avg) {
    avg.enabled = ruleEnabled(rules, 'buy-1') && ruleEnabled(rules, 'buy-2')
    avg.params.percent = ruleNumber(rules, 'buy-1', 'percent', 1)
    avg.params.steps = ruleNumber(rules, 'buy-2', 'steps', 5)
  }

  const spread = findCondition(conditions, 'spread_ok')
  if (spread) {
    spread.enabled = ruleEnabled(rules, 'buy-8')
    spread.params.maxSpreadPercent = ruleNumber(rules, 'buy-8', 'percent', 50)
  }

  const noTx = findCondition(conditions, 'no_transaction_in_progress')
  if (noTx) {
    noTx.enabled = ruleEnabled(rules, 'buy-6')
    noTx.params.require = ruleEnabled(rules, 'buy-6')
  }

  const delay = findCondition(conditions, 'transaction_delay_ok')
  if (delay) {
    delay.enabled = ruleEnabled(rules, 'buy-5')
    delay.params.minDelayMs = ruleNumber(rules, 'buy-5', 'ms', 60000)
  }

  const balance = findCondition(conditions, 'balance_ok')
  if (balance) {
    const enabled = ruleEnabled(rules, 'buy-10', false)
    balance.enabled = enabled
    balance.params.require = enabled
    if (enabled) {
      balance.params.minBalance = ruleNumber(rules, 'buy-10', 'percent', 1000)
    }
  }
}

function applySellRules(conditions: ServerCondition[], rules: TradingRuleState[]) {
  const avg = findCondition(conditions, 'avg_observed_higher_for_last_steps')
  if (avg) {
    avg.enabled = ruleEnabled(rules, 'sell-3') && ruleEnabled(rules, 'sell-4')
    avg.params.percent = ruleNumber(rules, 'sell-3', 'percent', 1)
    avg.params.steps = ruleNumber(rules, 'sell-4', 'steps', 5)
  }

  const noTx = findCondition(conditions, 'no_transaction_in_progress')
  if (noTx) {
    noTx.enabled = ruleEnabled(rules, 'sell-7')
    noTx.params.require = ruleEnabled(rules, 'sell-7')
  }

  const delay = findCondition(conditions, 'transaction_delay_ok')
  if (delay) {
    delay.enabled = ruleEnabled(rules, 'sell-9')
    delay.params.minDelayMs = ruleNumber(rules, 'sell-9', 'ms', 60000)
  }

  const balance = findCondition(conditions, 'balance_ok')
  if (balance) {
    const enabled = ruleEnabled(rules, 'sell-11', false)
    balance.enabled = enabled
    balance.params.require = enabled
    if (enabled) {
      balance.params.minBalance = ruleNumber(rules, 'sell-11', 'percent', 1000)
    }
  }
}

/** Map platform strategy editor rules to server strategy-config buy/sell sides. */
export function buildServerStrategySides(
  strategyId: string | undefined,
  defaults: StrategyDefaults,
): { buy: ServerCondition[]; sell: ServerCondition[] } {
  const rules =
    (strategyId ? getStrategyRulesForId(strategyId) : undefined) ?? createDefaultTradingRules()

  const buy = cloneDefaults(defaults, 'buy')
  const sell = cloneDefaults(defaults, 'sell')
  applyBuyRules(buy, rules)
  applySellRules(sell, rules)

  return { buy, sell }
}
