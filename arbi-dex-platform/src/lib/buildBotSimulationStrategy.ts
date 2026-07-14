import type { Bot } from '../data/mockData'
import { getPairExchangeConfig } from '../data/mockData'
import { FIXTURE_CHART_STRATEGY } from '../fixtures/fixtureStrategy'
import type { Strategy } from '../simulation/simulationStrategy'
import { exchangeId } from '../simulation/simulationNetworkTypes'

function mapBotStatus(status: Bot['status']): Strategy['status'] {
  if (status === 'active') return 'Running'
  if (status === 'paused') return 'Paused'
  return 'Stopped'
}

export function buildBotSimulationStrategy(bot: Bot): Strategy {
  const config = getPairExchangeConfig(bot.pair, bot.pairSetId)
  const tradingExchange = config?.tradingExchange ?? 'Binance'
  const allExchanges = config?.allExchanges ?? [tradingExchange, 'Bybit'].filter(
    (ex, idx, arr) => arr.indexOf(ex) === idx,
  )

  const pairEntries = allExchanges.map((exchange) => {
    const ex = exchangeId(exchange)
    return {
      pair: bot.pair,
      exchange,
      bidKey: `${ex}|${bot.pair}|bidPrice`,
      askKey: `${ex}|${bot.pair}|askPrice`,
    }
  })

  return {
    id: bot.id,
    name: bot.strategy,
    pair: pairEntries.length > 0 ? pairEntries : [{ pair: bot.pair, exchange: tradingExchange }],
    exchange: tradingExchange,
    networks: allExchanges,
    rules: FIXTURE_CHART_STRATEGY.rules,
    risk: 'Medium',
    status: mapBotStatus(bot.status),
    lastActivity: bot.lastTrade,
    enabled: bot.status === 'active',
    pnl: `${bot.profit >= 0 ? '+' : ''}${bot.profit}`,
    pnlPositive: bot.profit >= 0,
    profitCurrency: bot.profitCurrency ?? 'USDT',
    ruleConfigs: FIXTURE_CHART_STRATEGY.ruleConfigs,
  }
}
