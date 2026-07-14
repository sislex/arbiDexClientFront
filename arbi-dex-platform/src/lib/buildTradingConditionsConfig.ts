import type { Strategy } from '../simulation/simulationStrategy'
import type { StrategyEngineConfig } from '../engine/processAllStepsAndRecordResults'

export function buildTradingConditionsConfig(strategy: Strategy | null): StrategyEngineConfig {
  const rules = strategy?.ruleConfigs?.filter((rule) => rule.enabled) ?? []
  const parseThreshold = (raw: string | number | undefined) => {
    if (raw === undefined || raw === null || raw === '') return 0
    const parsed = Number.parseFloat(String(raw).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }
  const config: StrategyEngineConfig = {
    buy: {
      enabled: false,
      requireNoTransactionInProgress: false,
      avgObservedHigherThanBuyPercent: 0,
      avgObservedHigherThanBuyForLastSteps: { steps: 5, percent: 0 },
      maxBuySellSpreadPercent: 100,
      minDelayAfterLastFinishedTransactionMs: 0,
      requireToken1Balance: false,
      minToken1Balance: 0,
    },
    sell: {
      enabled: false,
      requireNoTransactionInProgress: false,
      avgObservedHigherThanSellPercent: 0,
      avgObservedHigherThanSellForLastSteps: { steps: 5, percent: 0 },
      maxBuySellSpreadPercent: 100,
      minDelayAfterLastFinishedTransactionMs: 0,
      requireToken2Balance: false,
      minToken2Balance: 0,
    },
  }
  for (const rule of rules) {
    if (rule.conditionId === 'buy-avg-above-buy-price') {
      config.buy.enabled = true
      config.buy.avgObservedHigherThanBuyPercent = parseThreshold(rule.threshold)
    }
    if (rule.conditionId === 'buy-avg-above-buy-price-for-last-steps-percent') {
      config.buy.enabled = true
      config.buy.avgObservedHigherThanBuyForLastSteps.percent = parseThreshold(rule.threshold)
    }
    if (rule.conditionId === 'buy-avg-above-buy-price-for-last-steps-count') {
      config.buy.enabled = true
      config.buy.avgObservedHigherThanBuyForLastSteps.steps = Math.max(1, Math.floor(parseThreshold(rule.threshold)))
    }
    if (rule.conditionId === 'block-buy-while-transaction-running') {
      config.buy.enabled = true
      config.buy.requireNoTransactionInProgress = true
    }
    if (rule.conditionId === 'block-buy-when-buy-above-sell') {
      config.buy.enabled = true
      config.buy.maxBuySellSpreadPercent = parseThreshold(rule.threshold)
    }
    if (rule.conditionId === 'block-buy-after-last-transaction') {
      config.buy.enabled = true
      config.buy.minDelayAfterLastFinishedTransactionMs = parseThreshold(rule.threshold)
    }
    if (rule.conditionId === 'buy-min-token1-balance') {
      config.buy.enabled = true
      config.buy.requireToken1Balance = true
      config.buy.minToken1Balance = parseThreshold(rule.threshold)
    }

    if (rule.conditionId === 'sell-avg-below-sell-price') {
      config.sell.enabled = true
      config.sell.avgObservedHigherThanSellPercent = parseThreshold(rule.threshold)
    }
    if (rule.conditionId === 'sell-avg-above-sell-price-for-last-steps-percent') {
      config.sell.enabled = true
      config.sell.avgObservedHigherThanSellForLastSteps.percent = parseThreshold(rule.threshold)
    }
    if (rule.conditionId === 'sell-avg-above-sell-price-for-last-steps-count') {
      config.sell.enabled = true
      config.sell.avgObservedHigherThanSellForLastSteps.steps = Math.max(1, Math.floor(parseThreshold(rule.threshold)))
    }
    if (rule.conditionId === 'block-sell-while-transaction-running') {
      config.sell.enabled = true
      config.sell.requireNoTransactionInProgress = true
    }
    if (rule.conditionId === 'block-sell-after-last-transaction') {
      config.sell.enabled = true
      config.sell.minDelayAfterLastFinishedTransactionMs = parseThreshold(rule.threshold)
    }
    if (rule.conditionId === 'sell-min-token2-balance') {
      config.sell.enabled = true
      config.sell.requireToken2Balance = true
      config.sell.minToken2Balance = parseThreshold(rule.threshold)
    }
  }
  if (strategy?.enabled === false) {
    config.buy.enabled = false
    config.sell.enabled = false
  }
  return config
}
