import type { StrategyData } from '../data/mockData'
import { STRATEGY_DATA } from '../data/mockData'

export const STRATEGIES_STORAGE_KEY = 'arbidex-strategies'

export function loadStrategies(fallback: StrategyData[] = STRATEGY_DATA): StrategyData[] {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(STRATEGIES_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as StrategyData[]
    if (!Array.isArray(parsed)) return fallback
    return parsed
  } catch {
    return fallback
  }
}

export function saveStrategies(strategies: StrategyData[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STRATEGIES_STORAGE_KEY, JSON.stringify(strategies))
  } catch {
    // ignore quota / private mode errors
  }
}
