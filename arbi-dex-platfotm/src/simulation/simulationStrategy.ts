export type StrategyRuleAction = 'BUY' | 'SELL' | 'BLOCK_BUY' | 'BLOCK_SELL'

export interface StrategyRule {
  id: string
  conditionId: string
  threshold: string
  action: StrategyRuleAction
  enabled: boolean
}

export interface Strategy {
  id: string
  name: string
  pair: Array<{ pair: string; exchange: string; bidKey?: string; askKey?: string }>
  sources?: Array<{
    id: string
    label: string
    pair: string
    bidKey: string
    askKey: string
    type: 'cex' | 'dex'
  }>
  exchange: string
  networks: string[]
  rules: number
  risk: string
  status: 'Running' | 'Paused' | 'Stopped' | 'Error'
  lastActivity: string
  enabled: boolean
  pnl: string
  pnlPositive: boolean
  profitCurrency: string
  ruleConfigs?: StrategyRule[]
}
