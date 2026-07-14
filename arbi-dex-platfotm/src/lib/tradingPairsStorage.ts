import type { TradingPair } from '../data/mockData'
import { TRADING_PAIRS, migrateDexData, migrateExchangeName } from '../data/mockData'
import { rebuildSelectedExchanges } from '../types/chart'

export const TRADING_PAIRS_STORAGE_KEY = 'arbidex-trading-pairs'

function normalizePair(raw: TradingPair): TradingPair {
  const purpose = raw.purpose ?? 'trading'
  const { dexEntries, dexAddresses } = migrateDexData(raw.dexAddresses ?? {}, raw.dexEntries ?? [])
  const exchanges = rebuildSelectedExchanges(raw.exchanges ?? [], dexEntries)
  const tradingExchangeRaw = purpose === 'monitoring' ? null : raw.tradingExchange
  const migratedTrading = tradingExchangeRaw ? migrateExchangeName(tradingExchangeRaw, dexEntries) : null
  const tradingExchange =
    migratedTrading && exchanges.includes(migratedTrading) ? migratedTrading : null

  return {
    ...raw,
    name: raw.name || raw.pair.replace('/', ' / '),
    purpose,
    exchanges,
    tradingExchange:
      purpose === 'monitoring' || !tradingExchange || !exchanges.includes(tradingExchange)
        ? null
        : tradingExchange,
    dexEntries,
    dexAddresses,
  }
}

export function loadTradingPairs(fallback: TradingPair[] = TRADING_PAIRS): TradingPair[] {
  if (typeof window === 'undefined') return fallback.map(normalizePair)
  try {
    const raw = localStorage.getItem(TRADING_PAIRS_STORAGE_KEY)
    if (!raw) return fallback.map(normalizePair)
    const parsed = JSON.parse(raw) as TradingPair[]
    if (!Array.isArray(parsed)) return fallback.map(normalizePair)
    return parsed.map(normalizePair)
  } catch {
    return fallback.map(normalizePair)
  }
}

export function saveTradingPairs(pairs: TradingPair[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(TRADING_PAIRS_STORAGE_KEY, JSON.stringify(pairs))
  } catch {
    // ignore quota / private mode errors
  }
}

export function getStoredTradingPairs(): TradingPair[] {
  return loadTradingPairs(TRADING_PAIRS)
}
