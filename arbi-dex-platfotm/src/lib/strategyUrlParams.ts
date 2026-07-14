import type { TradingRuleState } from '../types/tradingRules'
import type { StrategyDraft } from '../types/tradingRules'

export function rulesToSearchParams(rules: TradingRuleState[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rule of rules) {
    if (!rule.enabled) continue
    out[`${rule.id}.on`] = '1'
    for (const [key, value] of Object.entries(rule.values)) {
      if (Number.isFinite(value)) out[`${rule.id}.${key}`] = String(value)
    }
  }
  return out
}

export function mergeRulesFromSearchParams(
  rules: TradingRuleState[],
  params: URLSearchParams,
): TradingRuleState[] {
  const hasRuleParams = (ruleId: string) =>
    [...params.keys()].some((key) => key.startsWith(`${ruleId}.`))

  return rules.map((rule) => {
    const enabled = hasRuleParams(rule.id)
      ? params.get(`${rule.id}.on`) === '1'
      : rule.enabled
    const values = { ...rule.values }

    for (const key of params.keys()) {
      if (!key.startsWith(`${rule.id}.`) || key.endsWith('.on')) continue
      const paramKey = key.slice(rule.id.length + 1)
      const raw = params.get(key)
      if (raw === null) continue
      const num = Number(raw)
      if (Number.isFinite(num)) values[paramKey] = num
    }

    return { ...rule, enabled, values }
  })
}

export function draftToSearchParams(draft: StrategyDraft): Record<string, string> {
  return {
    ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...rulesToSearchParams(draft.rules),
  }
}

export function draftFromSearchParams(
  params: URLSearchParams,
  fallback: StrategyDraft,
): StrategyDraft {
  const name = params.get('name') ?? fallback.name
  const description = params.get('description') ?? fallback.description
  const rules = mergeRulesFromSearchParams(fallback.rules, params)
  return { name, description, rules }
}
