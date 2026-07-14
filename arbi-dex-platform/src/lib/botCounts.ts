import type { Bot } from '../data/mockData'

export function botUsesStrategy(bot: Bot, strategyId: string, strategyName: string): boolean {
  if (bot.strategyId) return bot.strategyId === strategyId
  return bot.strategy === strategyName
}

export function countBotsForStrategy(bots: readonly Bot[], strategyId: string, strategyName: string): number {
  return bots.filter((bot) => botUsesStrategy(bot, strategyId, strategyName)).length
}

export function countBotsForPairSymbol(bots: readonly Bot[], pairSymbol: string): number {
  return bots.filter((bot) => bot.pair === pairSymbol).length
}

export function buildStrategyBotCountMap(
  bots: readonly Bot[],
  strategies: readonly { id: string; name: string }[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const strategy of strategies) {
    counts.set(strategy.id, countBotsForStrategy(bots, strategy.id, strategy.name))
  }
  return counts
}

export function buildPairBotCountMap(
  bots: readonly Bot[],
  pairs: readonly { id: string; pair: string }[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const pair of pairs) {
    counts.set(pair.id, countBotsForPairSymbol(bots, pair.pair))
  }
  return counts
}
