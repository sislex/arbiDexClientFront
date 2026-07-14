import { loadTradingPairs } from '../lib/tradingPairsStorage'
import { loadBots } from '../lib/botsStorage'
import { loadStrategies } from '../lib/strategiesStorage'
import type { DexEntry, DexTokenAddresses } from '../types/chart'
import { generateSelectionId, isDexEntryLabel, rebuildSelectedExchanges } from '../types/chart'
import { getCachedCatalogPairSymbols } from '../services/catalogService'

export const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT', 'ADA/USDT']

export const PAIR_MARKET_DATA: Record<string, { price: number; change: number }> = {
  'BTC/USDT': { price: 67420.5, change: 1.24 },
  'ETH/USDT': { price: 3842.18, change: 0.87 },
  'SOL/USDT': { price: 178.52, change: 2.41 },
  'XRP/USDT': { price: 0.5821, change: -0.34 },
  'BNB/USDT': { price: 612.45, change: 0.56 },
  'ADA/USDT': { price: 0.4612, change: -1.12 },
}

export function getPairOptions() {
  return getAvailablePairSymbols().map((pair) => ({
    pair,
    price: PAIR_MARKET_DATA[pair]?.price ?? 1000,
    change: PAIR_MARKET_DATA[pair]?.change ?? 0,
    botsCount: getBots().filter((b) => b.pair === pair && b.status === 'active').length,
  }))
}

export const STRATEGIES = [
  { id: 'scalping', name: 'Scalping', type: 'Scalping', timeframe: '5m', category: 'Momentum' },
  { id: 'mean-reversion', name: 'Mean Reversion', type: 'Mean Reversion', timeframe: '15m', category: 'Reversal' },
  { id: 'trend-following', name: 'Trend Following', type: 'Trend', timeframe: '1h', category: 'Trend' },
  { id: 'grid', name: 'Grid Trading', type: 'Grid', timeframe: '15m', category: 'Market Making' },
  { id: 'breakout', name: 'Breakout', type: 'Breakout', timeframe: '30m', category: 'Momentum' },
  { id: 'arbitrage', name: 'Arbitrage', type: 'Arbitrage', timeframe: '1m', category: 'Arbitrage' },
]

export const EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Kraken']

export type ExchangeSourceType = 'CEX' | 'DEX'

export interface ExchangeSource {
  id: string
  name: string
  type: ExchangeSourceType
}

export const EXCHANGE_SOURCES: ExchangeSource[] = [
  { id: 'binance', name: 'Binance', type: 'CEX' },
  { id: 'bybit', name: 'Bybit', type: 'CEX' },
  { id: 'dzengi', name: 'dzengi', type: 'CEX' },
  { id: 'gateio', name: 'Gate.io', type: 'CEX' },
  { id: 'kucoin', name: 'KuCoin', type: 'CEX' },
  { id: 'mexc', name: 'MEXC', type: 'CEX' },
  { id: 'okx', name: 'OKX', type: 'CEX' },
  { id: 'kraken', name: 'Kraken', type: 'CEX' },
]

export const CEX_SOURCES = EXCHANGE_SOURCES.filter((s) => s.type === 'CEX')

export interface DexNetwork {
  id: string
  name: string
}

export const DEX_NETWORKS: DexNetwork[] = [
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'optimism', name: 'Optimism' },
  { id: 'base', name: 'Base' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'bsc', name: 'BSC' },
  { id: 'avalanche', name: 'Avalanche' },
  { id: 'zksync', name: 'zkSync' },
  { id: 'linea', name: 'Linea' },
  { id: 'fantom', name: 'Fantom' },
]

const LEGACY_DEX_KEY_MAP: Record<string, string> = {
  'Arbitrum DEX': 'Arbitrum',
  Uniswap: 'Ethereum',
}

export function isDexNetwork(name: string): boolean {
  return DEX_NETWORKS.some((n) => n.name === name)
}

/** @deprecated use isDexNetwork */
export function isDexExchange(name: string): boolean {
  return isDexNetwork(name)
}

export function isCexExchange(name: string): boolean {
  return CEX_SOURCES.some((s) => s.name === name)
}

export function migrateDexAddresses(
  dexAddresses: Record<string, DexTokenAddresses> = {},
): Record<string, DexTokenAddresses> {
  const result: Record<string, DexTokenAddresses> = {}
  for (const [key, addresses] of Object.entries(dexAddresses)) {
    const mapped = LEGACY_DEX_KEY_MAP[key] ?? key
    if (isDexNetwork(mapped)) {
      result[mapped] = addresses
    }
  }
  return result
}

export function inferDexEntries(
  dexAddresses: Record<string, DexTokenAddresses> = {},
  existing: DexEntry[] = [],
): DexEntry[] {
  if (existing.length > 0) return existing
  const migrated = migrateDexAddresses(dexAddresses)
  return Object.keys(migrated).map((network) => ({
    id: generateSelectionId(),
    network,
  }))
}

export function migrateDexData(
  dexAddresses: Record<string, DexTokenAddresses> = {},
  dexEntries: DexEntry[] = [],
): { dexEntries: DexEntry[]; dexAddresses: Record<string, DexTokenAddresses> } {
  if (dexEntries.length > 0) {
    const byId: Record<string, DexTokenAddresses> = {}
    for (const entry of dexEntries) {
      byId[entry.id] =
        dexAddresses[entry.id] ??
        dexAddresses[entry.network] ??
        { base: '', quote: '' }
    }
    return { dexEntries, dexAddresses: byId }
  }

  const networkKeyed = migrateDexAddresses(dexAddresses)
  const entries = Object.keys(networkKeyed).map((network) => ({
    id: generateSelectionId(),
    network,
  }))
  const byId: Record<string, DexTokenAddresses> = {}
  entries.forEach((entry, index) => {
    byId[entry.id] = Object.values(networkKeyed)[index] ?? { base: '', quote: '' }
  })
  return { dexEntries: entries, dexAddresses: byId }
}

export function migrateExchangeName(name: string, dexEntries: DexEntry[] = []): string | null {
  const mapped = LEGACY_DEX_KEY_MAP[name] ?? name
  if (isCexExchange(mapped)) return mapped
  if (/^.+\s#0$/.test(mapped)) return null
  if (isDexEntryLabel(mapped, dexEntries)) return mapped
  return null
}

export function getAllExchangeNames(): string[] {
  return [...CEX_SOURCES.map((s) => s.name), ...DEX_NETWORKS.map((n) => n.name)]
}

export interface Bot {
  id: string
  name: string
  pair: string
  pairSetId?: string
  strategy: string
  strategyId: string
  balance: number
  roi: number
  profit: number
  winRate: number
  drawdown: number
  trades: number
  lastTrade: string
  runtime: string
  status: 'active' | 'paused' | 'stopped'
  startingBudget?: number
  maxTurnover?: number
  minStopBudget?: number
  peakStopPercent?: number
  profitCurrency?: string
}

export const BOTS: Bot[] = [
  { id: '1', name: 'BTC Scalper', pair: 'BTC/USDT', strategy: 'Scalping', strategyId: 'scalping', balance: 12450, roi: 18.4, profit: 2340, winRate: 72, drawdown: 4.2, trades: 342, lastTrade: '2 мин назад', runtime: '45d', status: 'active' },
  { id: '2', name: 'BTC Mean Reversion', pair: 'BTC/USDT', strategy: 'Mean Reversion', strategyId: 'mean-reversion', balance: 8900, roi: 12.1, profit: 1080, winRate: 65, drawdown: 6.8, trades: 156, lastTrade: '15 мин назад', runtime: '30d', status: 'active' },
  { id: '3', name: 'BTC Trend', pair: 'BTC/USDT', strategy: 'Trend Following', strategyId: 'trend-following', balance: 15200, roi: 22.7, profit: 3450, winRate: 68, drawdown: 8.1, trades: 89, lastTrade: '1ч назад', runtime: '60d', status: 'paused' },
  { id: '4', name: 'ETH Scalper', pair: 'ETH/USDT', strategy: 'Scalping', strategyId: 'scalping', balance: 7800, roi: 15.2, profit: 1180, winRate: 70, drawdown: 5.1, trades: 278, lastTrade: '5 мин назад', runtime: '38d', status: 'active' },
  { id: '5', name: 'ETH Grid', pair: 'ETH/USDT', strategy: 'Grid Trading', strategyId: 'grid', balance: 5600, roi: 8.9, profit: 490, winRate: 58, drawdown: 3.2, trades: 412, lastTrade: '30 мин назад', runtime: '25d', status: 'active' },
  { id: '6', name: 'SOL Breakout', pair: 'SOL/USDT', strategy: 'Breakout', strategyId: 'breakout', balance: 4200, roi: 28.3, profit: 980, winRate: 61, drawdown: 12.4, trades: 67, lastTrade: '3ч назад', runtime: '20d', status: 'active' },
  { id: '7', name: 'SOL Scalper', pair: 'SOL/USDT', strategy: 'Scalping', strategyId: 'scalping', balance: 3100, roi: -3.2, profit: -102, winRate: 45, drawdown: 15.6, trades: 134, lastTrade: '1д назад', runtime: '15d', status: 'stopped' },
  { id: '8', name: 'XRP Arbitrage', pair: 'XRP/USDT', strategy: 'Arbitrage', strategyId: 'arbitrage', balance: 6500, roi: 6.4, profit: 390, winRate: 82, drawdown: 1.2, trades: 890, lastTrade: '1 мин назад', runtime: '50d', status: 'active' },
  { id: '9', name: 'BNB Trend', pair: 'BNB/USDT', strategy: 'Trend Following', strategyId: 'trend-following', balance: 9800, roi: 14.8, profit: 1260, winRate: 63, drawdown: 7.3, trades: 45, lastTrade: '4ч назад', runtime: '42d', status: 'active' },
  { id: '10', name: 'ADA Mean Rev', pair: 'ADA/USDT', strategy: 'Mean Reversion', strategyId: 'mean-reversion', balance: 2800, roi: 5.1, profit: 140, winRate: 55, drawdown: 9.8, trades: 98, lastTrade: '6ч назад', runtime: '18d', status: 'paused' },
]

export function getBots(): Bot[] {
  return loadBots(BOTS)
}

export function getBotById(id: string): Bot | undefined {
  return getBots().find((b) => b.id === id)
}

export type PairPurpose = 'trading' | 'monitoring'

export interface TradingPair {
  id: string
  name: string
  pair: string
  purpose: PairPurpose
  exchanges: string[]
  tradingExchange: string | null
  dexAddresses?: Record<string, { base: string; quote: string }>
  dexEntries?: DexEntry[]
  coins: string[]
  priceMethod: string
  runningBots: number
  strategies: number
  created: string
  status: 'active' | 'inactive'
  spotFutures: 'spot' | 'futures'
}

export const TRADING_PAIRS: TradingPair[] = [
  { id: '1', name: 'BTC Main', pair: 'BTC/USDT', purpose: 'trading', exchanges: ['Binance', 'Bybit', 'OKX'], tradingExchange: 'Binance', coins: ['BTC', 'USDT'], priceMethod: 'Average', runningBots: 3, strategies: 4, created: '2025-01-15', status: 'active', spotFutures: 'spot' },
  { id: '2', name: 'ETH Spot', pair: 'ETH/USDT', purpose: 'trading', exchanges: ['Binance', 'Kraken'], tradingExchange: 'Binance', coins: ['ETH', 'USDT'], priceMethod: 'Weighted', runningBots: 2, strategies: 3, created: '2025-01-20', status: 'active', spotFutures: 'spot' },
  { id: '3', name: 'SOL Futures', pair: 'SOL/USDT', purpose: 'trading', exchanges: ['Bybit', 'OKX'], tradingExchange: 'Bybit', coins: ['SOL', 'USDT'], priceMethod: 'Average', runningBots: 2, strategies: 2, created: '2025-02-01', status: 'active', spotFutures: 'futures' },
  { id: '4', name: 'XRP Cross', pair: 'XRP/USDT', purpose: 'trading', exchanges: ['Binance', 'Kraken'], tradingExchange: 'Binance', coins: ['XRP', 'USDT'], priceMethod: 'Median', runningBots: 1, strategies: 2, created: '2025-02-10', status: 'active', spotFutures: 'spot' },
  { id: '5', name: 'BNB Binance', pair: 'BNB/USDT', purpose: 'trading', exchanges: ['Binance'], tradingExchange: 'Binance', coins: ['BNB', 'USDT'], priceMethod: 'Average', runningBots: 1, strategies: 2, created: '2025-02-15', status: 'active', spotFutures: 'futures' },
  { id: '6', name: 'ADA Dual', pair: 'ADA/USDT', purpose: 'trading', exchanges: ['Binance', 'Bybit'], tradingExchange: 'Binance', coins: ['ADA', 'USDT'], priceMethod: 'Average', runningBots: 1, strategies: 1, created: '2025-03-01', status: 'inactive', spotFutures: 'spot' },
  { id: '7', name: 'ETH Watch', pair: 'ETH/USDT', purpose: 'monitoring', exchanges: ['Binance', 'Bybit', 'OKX', 'Kraken'], tradingExchange: null, coins: ['ETH', 'USDT'], priceMethod: 'Average', runningBots: 0, strategies: 0, created: '2025-03-10', status: 'active', spotFutures: 'spot' },
]

export function getTradingPairs(): TradingPair[] {
  return loadTradingPairs(TRADING_PAIRS)
}

export function getTradingPairById(id: string): TradingPair | undefined {
  return getTradingPairs().find((p) => p.id === id)
}

export function getTradableTradingPairs(): TradingPair[] {
  return getTradingPairs().filter((p) => p.purpose !== 'monitoring')
}

export function getMonitoringTradingPairs(): TradingPair[] {
  return getTradingPairs().filter((p) => p.purpose === 'monitoring')
}

export function isMonitoringPair(tp: TradingPair): boolean {
  return tp.purpose === 'monitoring'
}

export function getAvailablePairSymbols(): string[] {
  const apiPairs = getCachedCatalogPairSymbols()
  const stored = getTradingPairs().map((p) => p.pair)
  return [...new Set([...apiPairs, ...stored])].sort((a, b) => a.localeCompare(b))
}

export interface PairExchangeConfig {
  pair: string
  purpose: PairPurpose
  tradingExchange: string | null
  referenceExchanges: string[]
  allExchanges: string[]
  priceMethod: string
}

export function getPairExchangeConfig(pair: string, pairSetId?: string): PairExchangeConfig | null {
  const all = getTradingPairs()
  const tp = pairSetId
    ? all.find((p) => p.id === pairSetId)
    : all.find((p) => p.pair === pair && p.purpose !== 'monitoring') ?? all.find((p) => p.pair === pair)
  if (!tp) return null
  const isMonitoring = tp.purpose === 'monitoring'
  const referenceExchanges = isMonitoring
    ? tp.exchanges
    : tp.exchanges.filter((e) => e !== tp.tradingExchange)
  return {
    pair: tp.pair,
    purpose: tp.purpose ?? 'trading',
    tradingExchange: tp.tradingExchange,
    referenceExchanges,
    allExchanges: tp.exchanges,
    priceMethod: tp.priceMethod,
  }
}

export type ExchangeChartPoint = {
  time: number
  label: string
  trading: number
  average: number
} & Record<string, number | string>

const EXCHANGE_CHART_COLORS: Record<string, string> = {
  Binance: '#F0B90B',
  Bybit: '#F7A600',
  OKX: '#FFFFFF',
  Kraken: '#5741D9',
  Ethereum: '#627EEA',
  Arbitrum: '#28A0F0',
  Optimism: '#FF0420',
  Base: '#0052FF',
  Polygon: '#8247E5',
  BSC: '#F0B90B',
  Avalanche: '#E84142',
  zkSync: '#8C8DFC',
  Linea: '#121212',
  Fantom: '#1969FF',
}

export function getExchangeColor(exchange: string): string {
  return EXCHANGE_CHART_COLORS[exchange] ?? '#94A3B8'
}

export function generateExchangeChartData(pair: string, points = 60, pairSetId?: string): ExchangeChartPoint[] {
  const config = getPairExchangeConfig(pair, pairSetId)
  const basePrice = PAIR_MARKET_DATA[pair]?.price ?? 1000
  if (!config) {
    return Array.from({ length: points }, (_, i) => ({
      time: i,
      label: `${points - i}m`,
      trading: basePrice,
      average: basePrice,
    }))
  }

  const exchangeBias: Record<string, number> = {}
  config.allExchanges.forEach((ex, idx) => {
    exchangeBias[ex] = (idx - (config.allExchanges.length - 1) / 2) * basePrice * 0.0004
  })

  return Array.from({ length: points }, (_, i) => {
    const wave = Math.sin(i / 5) * basePrice * 0.004
    const trend = (i - points / 2) * basePrice * 0.00002

    const point: ExchangeChartPoint = {
      time: i,
      label: `${points - i}m`,
      trading: 0,
      average: 0,
    }

    const referencePrices: number[] = []

    for (const ex of config.allExchanges) {
      const noise = Math.sin(i * 0.85 + ex.length * 1.7) * basePrice * 0.0006
      const price = basePrice + wave + trend + exchangeBias[ex] + noise
      const rounded = Math.round(price * (basePrice < 10 ? 10000 : 100)) / (basePrice < 10 ? 10000 : 100)
      point[ex] = rounded

      if (config.purpose === 'monitoring' || !config.tradingExchange) {
        referencePrices.push(rounded)
      } else if (ex === config.tradingExchange) {
        point.trading = rounded
      } else {
        referencePrices.push(rounded)
      }
    }

    point.average =
      referencePrices.length > 0
        ? Math.round((referencePrices.reduce((a, b) => a + b, 0) / referencePrices.length) * 100) / 100
        : point.trading

    return point
  })
}

export function getExchangesForPair(pair: string): string[] {
  const tp = getTradingPairs().find((p) => p.pair === pair)
  if (!tp) return [...EXCHANGES]
  const cleaned = rebuildSelectedExchanges(tp.exchanges ?? [], tp.dexEntries ?? [])
  const cexOnly = cleaned.filter((name) => isCexExchange(name))
  return cexOnly.length > 0 ? cexOnly : [...EXCHANGES]
}

export function getDefaultTradingExchange(pair: string): string | null {
  const tp = getTradingPairs().find((p) => p.pair === pair && p.purpose !== 'monitoring')
  return tp?.tradingExchange ?? EXCHANGES[0]
}

export type MultiPairChartPoint = {
  time: number
  label: string
} & Record<string, number | string>

/** Raw prices keyed by `pair::exchange`, plus `pair::average` per pair column */
export function generateMultiPairChartData(
  selections: {
    id?: string
    pair: string
    purpose?: PairPurpose
    selectedExchanges: string[]
    tradingExchange: string | null
  }[],
  points = 60,
): MultiPairChartPoint[] {
  if (selections.length === 0) return []

  const pairSeries = selections.map((sel) => ({
    ...sel,
    raw: generateExchangeChartData(sel.pair, points, sel.id),
  }))

  return Array.from({ length: points }, (_, i) => {
    const point: MultiPairChartPoint = {
      time: i,
      label: `${points - i}m`,
    }

    for (const { pair, purpose, selectedExchanges, tradingExchange, raw } of pairSeries) {
      const row = raw[i]
      const refPrices: number[] = []
      const monitoring = purpose === 'monitoring' || !tradingExchange

      for (const ex of selectedExchanges) {
        const price = Number(row[ex] ?? row.trading ?? 0)
        point[`${pair}::${ex}`] = price
        if (monitoring || ex !== tradingExchange) refPrices.push(price)
      }

      if (refPrices.length > 0) {
        point[`${pair}::average`] =
          Math.round((refPrices.reduce((a, b) => a + b, 0) / refPrices.length) * 10000) / 10000
      }

      if (!monitoring && tradingExchange) {
        point[`${pair}::trading`] = Number(row[tradingExchange] ?? row.trading ?? 0)
      }
    }

    return point
  })
}

export interface StrategyData {
  id: string
  name: string
  description: string
  type: string
  timeframe: string
  category: string
  winRate: number
  roi: number
  drawdown: number
  profitFactor: number
  sharpe: number
  runningBots: number
  usageCount: number
  lastProfit: number
  status: 'active' | 'inactive'
  risk: 'low' | 'medium' | 'high'
}

export function getStrategies(): StrategyData[] {
  return loadStrategies(STRATEGY_DATA)
}

export function getStrategyById(id: string): StrategyData | undefined {
  return getStrategies().find((s) => s.id === id)
}

export const STRATEGY_DATA: StrategyData[] = [
  { id: 'scalping', name: 'Scalping', description: 'Быстрые сделки на малых движениях цены с tight stop-loss', type: 'Scalping', timeframe: '5m', category: 'Momentum', winRate: 72, roi: 18.4, drawdown: 4.2, profitFactor: 2.1, sharpe: 1.8, runningBots: 3, usageCount: 12, lastProfit: 340, status: 'active', risk: 'medium' },
  { id: 'mean-reversion', name: 'Mean Reversion', description: 'Вход при отклонении от среднего, выход при возврате', type: 'Mean Reversion', timeframe: '15m', category: 'Reversal', winRate: 65, roi: 12.1, drawdown: 6.8, profitFactor: 1.7, sharpe: 1.4, runningBots: 2, usageCount: 8, lastProfit: 180, status: 'active', risk: 'low' },
  { id: 'trend-following', name: 'Trend Following', description: 'Следование за трендом с trailing stop-loss', type: 'Trend', timeframe: '1h', category: 'Trend', winRate: 68, roi: 22.7, drawdown: 8.1, profitFactor: 2.4, sharpe: 1.6, runningBots: 2, usageCount: 6, lastProfit: 520, status: 'active', risk: 'medium' },
  { id: 'grid', name: 'Grid Trading', description: 'Сетка ордеров в диапазоне цен', type: 'Grid', timeframe: '15m', category: 'Market Making', winRate: 58, roi: 8.9, drawdown: 3.2, profitFactor: 1.5, sharpe: 1.2, runningBots: 1, usageCount: 4, lastProfit: 90, status: 'active', risk: 'low' },
  { id: 'breakout', name: 'Breakout', description: 'Вход при пробое ключевых уровней', type: 'Breakout', timeframe: '30m', category: 'Momentum', winRate: 61, roi: 28.3, drawdown: 12.4, profitFactor: 2.8, sharpe: 1.9, runningBots: 1, usageCount: 3, lastProfit: 280, status: 'active', risk: 'high' },
  { id: 'arbitrage', name: 'Arbitrage', description: 'Арбитраж между биржами', type: 'Arbitrage', timeframe: '1m', category: 'Arbitrage', winRate: 82, roi: 6.4, drawdown: 1.2, profitFactor: 3.1, sharpe: 2.2, runningBots: 1, usageCount: 5, lastProfit: 45, status: 'active', risk: 'low' },
]

export interface StoreStrategy extends StrategyData {
  purchased: boolean
  price: number
}

export const STORE_STRATEGIES: StoreStrategy[] = [
  { id: 'store-vwap', name: 'VWAP Reclaim Pro', description: 'Профессиональный вход по VWAP с фильтром объёма', type: 'VWAP', timeframe: '5m', category: 'Momentum', winRate: 74, roi: 31.2, drawdown: 5.8, profitFactor: 2.6, sharpe: 2.1, runningBots: 0, usageCount: 1240, lastProfit: 0, status: 'active', risk: 'medium', purchased: true, price: 0 },
  { id: 'store-smart-dca', name: 'Smart DCA Ladder', description: 'Адаптивное усреднение с динамическими уровнями', type: 'DCA', timeframe: '15m', category: 'Accumulation', winRate: 69, roi: 26.8, drawdown: 7.4, profitFactor: 2.2, sharpe: 1.9, runningBots: 0, usageCount: 890, lastProfit: 0, status: 'active', risk: 'low', purchased: false, price: 49 },
  { id: 'store-liquidity', name: 'Liquidity Sweep', description: 'Сбор ликвидности за локальными экстремумами', type: 'Liquidity', timeframe: '15m', category: 'Reversal', winRate: 66, roi: 24.5, drawdown: 9.1, profitFactor: 2.0, sharpe: 1.7, runningBots: 0, usageCount: 756, lastProfit: 0, status: 'active', risk: 'high', purchased: true, price: 0 },
  { id: 'store-funding', name: 'Funding Rate Arb', description: 'Арбитраж funding rate на perpetual', type: 'Funding', timeframe: '1h', category: 'Arbitrage', winRate: 78, roi: 19.6, drawdown: 2.4, profitFactor: 2.9, sharpe: 2.4, runningBots: 0, usageCount: 612, lastProfit: 0, status: 'active', risk: 'low', purchased: false, price: 79 },
  { id: 'store-momentum-burst', name: 'Momentum Burst', description: 'Импульсные входы на всплеске объёма', type: 'Momentum', timeframe: '5m', category: 'Momentum', winRate: 63, roi: 18.9, drawdown: 11.2, profitFactor: 1.9, sharpe: 1.5, runningBots: 0, usageCount: 534, lastProfit: 0, status: 'active', risk: 'high', purchased: false, price: 39 },
  { id: 'store-range-grid', name: 'Range Grid Elite', description: 'Сетка для боковика с авто-перестройкой диапазона', type: 'Grid', timeframe: '30m', category: 'Market Making', winRate: 71, roi: 17.3, drawdown: 4.6, profitFactor: 2.1, sharpe: 1.8, runningBots: 0, usageCount: 421, lastProfit: 0, status: 'active', risk: 'low', purchased: true, price: 0 },
]

export function generateEquityCurve(days = 30) {
  let value = 85000
  return Array.from({ length: days }, (_, i) => {
    value += (Math.random() - 0.35) * 800
    return {
      date: new Date(Date.now() - (days - i) * 86400000).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      equity: Math.round(value),
      profit: Math.round((Math.random() - 0.3) * 500),
    }
  })
}

export function generateDailyProfit(days = 14) {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - i) * 86400000).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
    profit: Math.round((Math.random() - 0.25) * 600),
  }))
}

export const BOT_DISTRIBUTION = [
  { name: 'Прибыльные', value: 7, color: '#10b981' },
  { name: 'Убыточные', value: 2, color: '#ef4444' },
  { name: 'Безубыточные', value: 1, color: '#64748b' },
]

export const RECENT_EVENTS = [
  { id: '1', time: '2 мин', text: 'BTC Scalper купил BTC @ $67,420', type: 'buy' },
  { id: '2', time: '5 мин', text: 'ETH Scalper продал ETH @ $3,842', type: 'sell' },
  { id: '3', time: '12 мин', text: 'XRP Arbitrage: арбитраж +$12.40', type: 'profit' },
  { id: '4', time: '18 мин', text: 'SOL Breakout: новая позиция открыта', type: 'buy' },
  { id: '5', time: '25 мин', text: 'BTC Trend поставлен на паузу', type: 'pause' },
  { id: '6', time: '1ч', text: 'BNB Trend: take profit @ $612', type: 'profit' },
]

export const MATRIX_DATA: Record<string, Record<string, { roi: number; winRate: number; profit: number }>> = {
  Scalping: {
    'BTC/USDT': { roi: 18.4, winRate: 72, profit: 2340 },
    'ETH/USDT': { roi: 15.2, winRate: 70, profit: 1180 },
    'SOL/USDT': { roi: -3.2, winRate: 45, profit: -102 },
    'XRP/USDT': { roi: 4.1, winRate: 58, profit: 210 },
    'BNB/USDT': { roi: 9.8, winRate: 64, profit: 540 },
    'ADA/USDT': { roi: 2.3, winRate: 52, profit: 65 },
  },
  'Mean Reversion': {
    'BTC/USDT': { roi: 12.1, winRate: 65, profit: 1080 },
    'ETH/USDT': { roi: 8.4, winRate: 62, profit: 420 },
    'SOL/USDT': { roi: 6.7, winRate: 59, profit: 280 },
    'XRP/USDT': { roi: 11.2, winRate: 68, profit: 380 },
    'BNB/USDT': { roi: 5.1, winRate: 55, profit: 190 },
    'ADA/USDT': { roi: 5.1, winRate: 55, profit: 140 },
  },
  'Trend Following': {
    'BTC/USDT': { roi: 22.7, winRate: 68, profit: 3450 },
    'ETH/USDT': { roi: 16.8, winRate: 64, profit: 1680 },
    'SOL/USDT': { roi: 19.2, winRate: 61, profit: 780 },
    'XRP/USDT': { roi: 3.4, winRate: 48, profit: 120 },
    'BNB/USDT': { roi: 14.8, winRate: 63, profit: 1260 },
    'ADA/USDT': { roi: 7.6, winRate: 57, profit: 210 },
  },
  'Grid Trading': {
    'BTC/USDT': { roi: 7.2, winRate: 56, profit: 680 },
    'ETH/USDT': { roi: 8.9, winRate: 58, profit: 490 },
    'SOL/USDT': { roi: 5.4, winRate: 54, profit: 220 },
    'XRP/USDT': { roi: 6.1, winRate: 60, profit: 310 },
    'BNB/USDT': { roi: 4.8, winRate: 52, profit: 180 },
    'ADA/USDT': { roi: 3.2, winRate: 50, profit: 90 },
  },
  Breakout: {
    'BTC/USDT': { roi: 14.6, winRate: 59, profit: 1890 },
    'ETH/USDT': { roi: 11.3, winRate: 57, profit: 890 },
    'SOL/USDT': { roi: 28.3, winRate: 61, profit: 980 },
    'XRP/USDT': { roi: -2.1, winRate: 42, profit: -80 },
    'BNB/USDT': { roi: 10.2, winRate: 56, profit: 620 },
    'ADA/USDT': { roi: 8.9, winRate: 54, profit: 250 },
  },
  Arbitrage: {
    'BTC/USDT': { roi: 3.8, winRate: 78, profit: 420 },
    'ETH/USDT': { roi: 4.2, winRate: 80, profit: 310 },
    'SOL/USDT': { roi: 5.1, winRate: 81, profit: 180 },
    'XRP/USDT': { roi: 6.4, winRate: 82, profit: 390 },
    'BNB/USDT': { roi: 3.9, winRate: 79, profit: 240 },
    'ADA/USDT': { roi: 4.6, winRate: 83, profit: 120 },
  },
}

export const TRADE_HISTORY = [
  { id: '1', time: '2025-07-09 11:14', bot: 'BTC Scalper', pair: 'BTC/USDT', side: 'buy', price: 67420, amount: 0.015, profit: null, status: 'open' },
  { id: '2', time: '2025-07-09 11:09', bot: 'ETH Scalper', pair: 'ETH/USDT', side: 'sell', price: 3842, amount: 0.5, profit: 28.4, status: 'closed' },
  { id: '3', time: '2025-07-09 10:57', bot: 'XRP Arbitrage', pair: 'XRP/USDT', side: 'buy', price: 0.582, amount: 1200, profit: 12.4, status: 'closed' },
  { id: '4', time: '2025-07-09 10:42', bot: 'SOL Breakout', pair: 'SOL/USDT', side: 'buy', price: 178.5, amount: 5, profit: null, status: 'open' },
  { id: '5', time: '2025-07-09 10:30', bot: 'BNB Trend', pair: 'BNB/USDT', side: 'sell', price: 612, amount: 2, profit: 45.2, status: 'closed' },
  { id: '6', time: '2025-07-09 09:15', bot: 'BTC Mean Reversion', pair: 'BTC/USDT', side: 'buy', price: 67100, amount: 0.02, profit: 64.0, status: 'closed' },
]

export const CANDLE_DATA = Array.from({ length: 60 }, (_, i) => {
  const base = 67000 + Math.sin(i / 5) * 500 + (Math.random() - 0.5) * 200
  const open = base
  const close = base + (Math.random() - 0.48) * 300
  const high = Math.max(open, close) + Math.random() * 150
  const low = Math.min(open, close) - Math.random() * 150
  return {
    time: i,
    open: Math.round(open),
    high: Math.round(high),
    low: Math.round(low),
    close: Math.round(close),
    volume: Math.round(Math.random() * 100),
  }
})
