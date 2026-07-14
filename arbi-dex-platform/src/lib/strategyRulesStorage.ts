import type { TradingRuleState } from '../types/tradingRules'

export const STRATEGY_RULES_STORAGE_KEY = 'arbidex-strategy-rules'

export type StrategyRulesMap = Record<string, TradingRuleState[]>

export function loadStrategyRules(): StrategyRulesMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STRATEGY_RULES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StrategyRulesMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveStrategyRules(rules: StrategyRulesMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STRATEGY_RULES_STORAGE_KEY, JSON.stringify(rules))
  } catch {
    // ignore quota / private mode errors
  }
}

export function saveStrategyRulesForId(strategyId: string, rules: TradingRuleState[]): void {
  const all = loadStrategyRules()
  all[strategyId] = rules
  saveStrategyRules(all)
}

export function removeStrategyRulesForId(strategyId: string): void {
  const all = loadStrategyRules()
  if (!(strategyId in all)) return
  delete all[strategyId]
  saveStrategyRules(all)
}

export function getStrategyRulesForId(strategyId: string): TradingRuleState[] | undefined {
  return loadStrategyRules()[strategyId]
}
