import type { Bot, TradingPair } from '../data/mockData'
import { getPairExchangeConfig, getTradingPairById, getTradingPairs, isCexExchange } from '../data/mockData'
import { selectionFromTradingPairRecord } from '../components/forms/AddPairsGridForm'
import { FIXTURE_CHART_STRATEGY } from '../fixtures/fixtureStrategy'
import type { Strategy } from '../simulation/simulationStrategy'
import type { ChartPairSelection } from '../types/chart'
import { exchangeId } from '../simulation/simulationNetworkTypes'
import { buildPreferredDexStoreKeys, defaultDexAddresses } from './dexStoreKeys'

function mapBotStatus(status: Bot['status']): Strategy['status'] {
  if (status === 'active') return 'Running'
  if (status === 'paused') return 'Paused'
  return 'Stopped'
}

/** ChartPairSelection для бота — те же ключи store, что в отслеживании / Live Trading. */
export function getBotChartSelection(bot: Bot): ChartPairSelection | null {
  const tp = bot.pairSetId
    ? getTradingPairById(bot.pairSetId)
    : getTradingPairs().find((p) => p.pair === bot.pair && (p.purpose ?? 'trading') !== 'monitoring')
  if (!tp) return null
  return selectionFromTradingPairRecord(tp)
}

function storeKeysForExchange(exchange: string, pair: string): { bidKey: string; askKey: string } {
  if (isCexExchange(exchange)) {
    const ex = exchangeId(exchange)
    return {
      bidKey: `${ex}|${pair}|bidPrice`,
      askKey: `${ex}|${pair}|askPrice`,
    }
  }
  const defaults = defaultDexAddresses(exchange, pair)
  if (!defaults) {
    return buildPreferredDexStoreKeys(exchange, 'x', 'y', pair)
  }
  return buildPreferredDexStoreKeys(exchange, defaults.base, defaults.quote, pair)
}

export function buildBotSimulationStrategy(bot: Bot): Strategy {
  const config = getPairExchangeConfig(bot.pair, bot.pairSetId)
  const tradingExchange = config?.tradingExchange ?? 'Binance'
  const allExchanges = config?.allExchanges ?? [tradingExchange, 'Bybit'].filter(
    (ex, idx, arr) => arr.indexOf(ex) === idx,
  )

  const pairEntries = allExchanges.map((exchange) => {
    const keys = storeKeysForExchange(exchange, bot.pair)
    return {
      pair: bot.pair,
      exchange,
      bidKey: keys.bidKey,
      askKey: keys.askKey,
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

/** Стратегия для Live Trading: из бота или синтетически из набора пар. */
export function buildLiveTradingStrategy(pairSet: TradingPair, bot?: Bot | null): Strategy {
  if (bot) {
    return buildBotSimulationStrategy({ ...bot, pairSetId: pairSet.id, pair: pairSet.pair })
  }
  return buildBotSimulationStrategy({
    id: `live-${pairSet.id}`,
    name: pairSet.name,
    pair: pairSet.pair,
    pairSetId: pairSet.id,
    strategy: 'Live Trading',
    strategyId: 'scalping',
    balance: 0,
    roi: 0,
    profit: 0,
    winRate: 0,
    drawdown: 0,
    trades: 0,
    lastTrade: '—',
    runtime: '—',
    status: 'active',
    profitCurrency: 'USDT',
  })
}
