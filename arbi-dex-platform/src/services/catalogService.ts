import { loadAuthResult } from '../lib/authStorage'
import { extractPairSymbolsFromKeys } from '../lib/parseMarketDataKeys'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
const STORE_API_BASE = import.meta.env.VITE_STORE_API_BASE ?? '/market-api'

const FALLBACK_PAIR_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'BNB/USDT', 'ADA/USDT']

export interface CatalogPairDto {
  id: string
  base: string
  quote: string
  displayName: string
}

let cachedPairSymbols: string[] | null = null
let loadPromise: Promise<string[]> | null = null

export function getCachedCatalogPairSymbols(): string[] {
  return cachedPairSymbols ?? FALLBACK_PAIR_SYMBOLS
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
    .filter((symbol) => symbol.includes('/'))

  return [...new Set(symbols)].sort((a, b) => a.localeCompare(b))
}

async function fetchPairsFromStoreKeys(): Promise<string[]> {
  const res = await fetch(`${STORE_API_BASE}/store/keys`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`store keys ${res.status}`)

  const keys = (await res.json()) as string[]
  if (!Array.isArray(keys)) throw new Error('invalid store keys payload')

  const symbols = extractPairSymbolsFromKeys(keys)
  if (symbols.length === 0) throw new Error('no pairs in store keys')
  return symbols
}

export async function loadCatalogPairSymbols(force = false): Promise<string[]> {
  if (!force && cachedPairSymbols) return cachedPairSymbols
  if (!force && loadPromise) return loadPromise

  loadPromise = (async () => {
    // Store API не требует arbi-dex-server — приоритет в dev
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

    cachedPairSymbols = FALLBACK_PAIR_SYMBOLS
    return FALLBACK_PAIR_SYMBOLS
  })().finally(() => {
    loadPromise = null
  })

  return loadPromise
}

export function invalidateCatalogPairSymbolsCache(): void {
  cachedPairSymbols = null
}
