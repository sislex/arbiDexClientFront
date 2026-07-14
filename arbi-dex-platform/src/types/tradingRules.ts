export type RuleSide = 'buy' | 'sell'

export type RulePart =
  | { type: 'text'; text: string }
  | { type: 'param'; key: string; suffix?: string; width?: number }

export interface TradingRuleDefinition {
  id: string
  number: number
  side: RuleSide
  parts: RulePart[]
  defaults: Record<string, number>
  defaultEnabled: boolean
}

export interface TradingRuleState {
  id: string
  enabled: boolean
  values: Record<string, number>
}

export interface StrategyDraft {
  name: string
  description: string
  rules: TradingRuleState[]
}
