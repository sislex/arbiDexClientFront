import type { ChartPairSelection } from '../types/chart'
import { getEnabledDexEntryIds } from '../types/chart'
import type { BotDraft } from './botUrlParams'
import type { StrategyDraft } from '../types/tradingRules'

export function normalizeChartPairSelection(sel: ChartPairSelection) {
  return {
    name: sel.name.trim(),
    pair: sel.pair.trim(),
    purpose: sel.purpose,
    selectedExchanges: [...sel.selectedExchanges].sort(),
    tradingExchange: sel.tradingExchange,
    dexEntries: sel.dexEntries.map((e) => ({ id: e.id, network: e.network })),
    dexAddresses: sel.dexAddresses,
  }
}

export function isChartPairSelectionComplete(sel: ChartPairSelection | undefined): boolean {
  if (!sel) return false
  if (!sel.pair.trim()) return false
  if (!sel.name.trim()) return false
  if (sel.selectedExchanges.length === 0) return false
  if (sel.purpose === 'trading' && !sel.tradingExchange) return false

  const enabledDexIds = getEnabledDexEntryIds(sel.dexEntries, sel.selectedExchanges)
  for (const entryId of enabledDexIds) {
    const addrs = sel.dexAddresses[entryId]
    if (!addrs?.base.trim() || !addrs?.quote.trim()) return false
  }

  return true
}

export function hasChartPairSelectionChanged(
  current: ChartPairSelection | undefined,
  baseline: ChartPairSelection | undefined,
): boolean {
  if (!current || !baseline) return false
  return (
    JSON.stringify(normalizeChartPairSelection(current)) !==
    JSON.stringify(normalizeChartPairSelection(baseline))
  )
}

export function normalizeStrategyDraft(draft: StrategyDraft): StrategyDraft {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    rules: draft.rules.map((rule) => ({
      ...rule,
      values: { ...rule.values },
    })),
  }
}

export function isStrategyDraftComplete(draft: StrategyDraft): boolean {
  return draft.name.trim().length > 0
}

export function hasStrategyDraftChanged(current: StrategyDraft, baseline: StrategyDraft): boolean {
  return JSON.stringify(normalizeStrategyDraft(current)) !== JSON.stringify(normalizeStrategyDraft(baseline))
}

export function normalizeBotDraft(draft: BotDraft): BotDraft {
  return {
    name: draft.name.trim(),
    pairSetId: draft.pairSetId,
    pair: draft.pair,
    strategyIds: [...draft.strategyIds].sort(),
    launch: { ...draft.launch },
    status: draft.status,
  }
}

export function isBotLaunchValid(draft: BotDraft): boolean {
  const startingBudget = Number(draft.launch.startingBudget)
  const maxTurnover = Number(draft.launch.maxTurnover)
  const minStopBudget = Number(draft.launch.minStopBudget)
  const peakStopPercent = Number(draft.launch.peakStopPercent)

  return (
    startingBudget > 0 &&
    maxTurnover >= startingBudget &&
    minStopBudget > 0 &&
    minStopBudget < startingBudget &&
    peakStopPercent > 0 &&
    peakStopPercent <= 100
  )
}

export function isBotDraftComplete(draft: BotDraft): boolean {
  return (
    draft.name.trim().length > 0 &&
    draft.pairSetId.length > 0 &&
    draft.strategyIds.length > 0 &&
    isBotLaunchValid(draft)
  )
}

export function hasBotDraftChanged(current: BotDraft, baseline: BotDraft): boolean {
  return JSON.stringify(normalizeBotDraft(current)) !== JSON.stringify(normalizeBotDraft(baseline))
}
