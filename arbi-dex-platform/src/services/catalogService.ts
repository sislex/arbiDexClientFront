import { loadAuthResult } from '../lib/authStorage'
import {
  getCachedStoreMarketCatalog,
  loadStoreMarketCatalog,
} from './storeMarketCatalog'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export interface CatalogPairDto {
  id: string
  base: string
  quote: string
  displayName: string
}

let cachedPairSymbols: string[] | null = null
let loadPromise: Promise<string[]> | null = null

export function getCachedCatalogPairSymbols(): string[] {
  return cachedPairSymbols ?? getCachedStoreMarketCatalog()?.pairSymbols ?? []
}

async function fetchPairsFromAuthCatalog(): Promise<string[] | null> {
  const auth = loadAuthResult()
  if (!auth?.accessToken) return null

  const res = await fetch(`${API_BASE}/catalog/pairs`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null

  const pairs = (await res.json()) as CatalogPairDto[]
  if (!Array.isArray(pairs) || pairs.length === 0) return null

  const symbols = pairs
    .map((p) => p.displayName || `${p.base}/${p.quote}`)
    .filter((symbol) => symbol.includes('/') && !symbol.includes('0x'))

  return [...new Set(symbols)].sort((a, b) => a.localeCompare(b))
}

async function fetchPairsFromStoreKeys(): Promise<string[]> {
  const catalog = await loadStoreMarketCatalog()
  if (catalog.pairSymbols.length === 0) {
    throw new Error('no pairs in store keys')
  }
  return catalog.pairSymbols
}

export async function loadCatalogPairSymbols(force = false): Promise<string[]> {
  if (!force && cachedPairSymbols) return cachedPairSymbols
  if (!force && loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const fromStore = await fetchPairsFromStoreKeys()
      if (fromStore.length > 0) {
        cachedPairSymbols = fromStore
        return fromStore
      }
    } catch {
      // fallback to auth catalog
    }

    try {
      const fromCatalog = await fetchPairsFromAuthCatalog()
      if (fromCatalog && fromCatalog.length > 0) {
        cachedPairSymbols = fromCatalog
        return fromCatalog
      }
    } catch {
      // server unavailable
    }

    cachedPairSymbols = []
    return []
  })().finally(() => {
    loadPromise = null
  })

  return loadPromise
}

export function invalidateCatalogPairSymbolsCache(): void {
  cachedPairSymbols = null
}
