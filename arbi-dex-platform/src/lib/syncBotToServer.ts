import type { Bot, TradingPair } from '../data/mockData'
import { getPairExchangeConfig } from '../data/mockData'
import type { CatalogMarket } from '../services/configApi'
import { buildServerStrategySides } from './mapPlatformStrategyToServer'
import {
  createMarketConfig,
  createStrategyConfig,
  fetchCatalogMarkets,
  fetchMarketConfig,
  fetchMarketConfigs,
  fetchStrategyConfigs,
  fetchStrategyDefaults,
  updateMarketConfig,
  updateStrategyConfig,
  type MarketConfigDetail,
} from '../services/configApi'
import {
  createServerBot,
  updateServerBot,
  type ServerBotStatus,
} from '../services/botsApi'

const EXCHANGE_ALIASES: Record<string, string[]> = {
  binance: ['binance', 'cex_binance'],
  bybit: ['bybit', 'cex_bybit'],
  okx: ['okx', 'cex_okx'],
  kraken: ['kraken', 'cex_kraken'],
  mexc: ['mexc', 'cex_mex'],
  kucoin: ['kucoin', 'cex_kucoin'],
  'gate.io': ['gate.io', 'gateio', 'cex_gateio'],
  dzengi: ['dzengi'],
  ethereum: ['ethereum', 'arbitrum dex', 'dex:arbitrum', 'dex_arbitrum'],
  arbitrum: ['arbitrum', 'arbitrum dex', 'dex:arbitrum', 'dex_arbitrum'],
  optimism: ['optimism'],
  base: ['base'],
  polygon: ['polygon'],
  bsc: ['bsc'],
  avalanche: ['avalanche'],
  zksync: ['zksync'],
  linea: ['linea'],
  fantom: ['fantom'],
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

function pairToPairId(pair: string): string {
  const [base, quote] = pair.split('/')
  return `${base}_${quote}`
}

function exchangeTokens(exchangeName: string): string[] {
  const key = normalizeToken(exchangeName)
  const aliases = EXCHANGE_ALIASES[key] ?? [key]
  return aliases.map(normalizeToken)
}

function marketMatchesExchange(market: CatalogMarket, exchangeName: string): boolean {
  const tokens = exchangeTokens(exchangeName)
  const sourceName = normalizeToken(market.sourceName)
  const sourceId = normalizeToken(market.sourceId)
  return tokens.some(
    (token) =>
      sourceName.includes(token) ||
      sourceId.includes(token) ||
      token.includes(sourceName) ||
      token.includes(sourceId.replace(/^cex_/, '').replace(/^dex_/, '')),
  )
}

function marketMatchesPair(market: CatalogMarket, pair: string): boolean {
  const pairId = pairToPairId(pair)
  return market.pairId === pairId || `${market.base}/${market.quote}` === pair
}

export function resolveMarketId(
  markets: CatalogMarket[],
  exchangeName: string | null | undefined,
  pair: string,
): string | undefined {
  if (exchangeName) {
    const exact = markets.find(
      (market) => marketMatchesExchange(market, exchangeName) && marketMatchesPair(market, pair),
    )
    if (exact) return exact.id
  }
  return markets.find((market) => marketMatchesPair(market, pair))?.id
}

export function buildMarketConfigName(pairSet: TradingPair | undefined, pair: string): string {
  return pairSet ? `${pairSet.name} · ${pair}` : pair
}

export function buildMarketConfigPayload(
  pair: string,
  pairSet: TradingPair | undefined,
  markets: CatalogMarket[],
) {
  const exchangeConfig = getPairExchangeConfig(pair, pairSet?.id)
  const tradingExchange = exchangeConfig?.tradingExchange ?? pairSet?.tradingExchange ?? null
  const referenceExchanges =
    exchangeConfig?.referenceExchanges ??
    (pairSet?.exchanges.filter((e) => e !== tradingExchange) ?? [])

  const tradingMarketId = resolveMarketId(markets, tradingExchange, pair)
  if (!tradingMarketId) {
    throw new Error(
      `Не найден рынок для пары ${pair}${tradingExchange ? ` на ${tradingExchange}` : ''}. Проверьте набор пар и каталог рынков.`,
    )
  }

  const observedMarketIds = [
    ...new Set(
      referenceExchanges
        .map((exchange) => resolveMarketId(markets, exchange, pair))
        .filter((id): id is string => Boolean(id && id !== tradingMarketId)),
    ),
  ]

  const fallbackObserved = markets
    .filter(
      (market) =>
        market.id !== tradingMarketId &&
        market.kind === 'cex' &&
        marketMatchesPair(market, pair),
    )
    .map((market) => market.id)

  const resolvedObserved =
    observedMarketIds.length > 0
      ? observedMarketIds
      : [...new Set(fallbackObserved)].slice(0, 4)

  return {
    name: buildMarketConfigName(pairSet, pair),
    tradingMarketId,
    observedMarketIds: resolvedObserved,
    useWeightedAverage: true,
  }
}

function marketConfigNeedsUpdate(
  current: MarketConfigDetail,
  desired: ReturnType<typeof buildMarketConfigPayload>,
): boolean {
  const currentObserved = current.observedMarketIds ?? []
  if (currentObserved.length === 0 && desired.observedMarketIds.length > 0) return true
  if (!current.tradingMarketId && desired.tradingMarketId) return true
  if (current.tradingMarketId && current.tradingMarketId !== desired.tradingMarketId) return true
  return false
}

async function upsertMarketConfigId(
  bot: Bot,
  pairSet: TradingPair | undefined,
  markets: CatalogMarket[],
  existingConfigs: Awaited<ReturnType<typeof fetchMarketConfigs>>,
): Promise<string> {
  const desired = buildMarketConfigPayload(bot.pair, pairSet, markets)

  const syncExisting = async (configId: string) => {
    const current = await fetchMarketConfig(configId)
    if (marketConfigNeedsUpdate(current, desired)) {
      await updateMarketConfig(configId, {
        tradingMarketId: desired.tradingMarketId,
        observedMarketIds: desired.observedMarketIds,
        useWeightedAverage: desired.useWeightedAverage,
      })
    }
    return configId
  }

  if (bot.marketConfigId && existingConfigs.some((item) => item.id === bot.marketConfigId)) {
    return syncExisting(bot.marketConfigId)
  }

  const configName = buildMarketConfigName(pairSet, bot.pair)
  const matched = existingConfigs.find((item) => item.name === configName)
  if (matched) return syncExisting(matched.id)

  const created = await createMarketConfig(desired)
  return created.id
}

function mapLocalStatusToServer(status: Bot['status']): ServerBotStatus {
  if (status === 'active') return 'running'
  return status
}

async function ensureMarketConfigId(
  bot: Bot,
  pairSet: TradingPair | undefined,
  markets: CatalogMarket[],
  existingConfigs: Awaited<ReturnType<typeof fetchMarketConfigs>>,
): Promise<string> {
  return upsertMarketConfigId(bot, pairSet, markets, existingConfigs)
}

async function ensureStrategyConfigId(
  bot: Bot,
  defaults: Awaited<ReturnType<typeof fetchStrategyDefaults>>,
  existingConfigs: Awaited<ReturnType<typeof fetchStrategyConfigs>>,
): Promise<string> {
  const sides = buildServerStrategySides(bot.strategyId, defaults)
  const payload = { name: bot.strategy, buy: sides.buy, sell: sides.sell }

  if (bot.strategyConfigId && existingConfigs.some((item) => item.id === bot.strategyConfigId)) {
    await updateStrategyConfig(bot.strategyConfigId, payload)
    return bot.strategyConfigId
  }

  const matched = existingConfigs.find((item) => item.name === bot.strategy)
  if (matched) {
    await updateStrategyConfig(matched.id, payload)
    return matched.id
  }

  const created = await createStrategyConfig(payload)
  return created.id
}

export interface SyncBotToServerOptions {
  pairSet?: TradingPair
}

/** Creates or updates the server-side bot linked to a local bot record. */
export async function syncBotToServer(bot: Bot, options: SyncBotToServerOptions = {}): Promise<Bot> {
  const [markets, marketConfigs, strategyConfigs, strategyDefaults] = await Promise.all([
    fetchCatalogMarkets(),
    fetchMarketConfigs(),
    fetchStrategyConfigs(),
    fetchStrategyDefaults(),
  ])

  const marketConfigId = await ensureMarketConfigId(bot, options.pairSet, markets, marketConfigs)
  const strategyConfigId = await ensureStrategyConfigId(bot, strategyDefaults, strategyConfigs)

  const [baseAsset, quoteAssetFromPair] = bot.pair.split('/')
  const payload = {
    name: bot.name,
    mode: 'demo-live' as const,
    status: mapLocalStatusToServer(bot.status),
    marketConfigId,
    strategyConfigId,
    baseAsset,
    quoteAsset: bot.profitCurrency ?? quoteAssetFromPair,
    initialBalance: bot.startingBudget ?? bot.balance,
  }

  if (bot.serverBotId) {
    const updated = await updateServerBot(bot.serverBotId, payload)
    return {
      ...bot,
      serverBotId: updated.id,
      marketConfigId,
      strategyConfigId,
    }
  }

  const created = await createServerBot(payload)
  return {
    ...bot,
    serverBotId: created.id,
    marketConfigId,
    strategyConfigId,
  }
}
