import { fetchStoreKeyCatalog, invalidateStoreKeyCatalog } from './chartDataService'
import {
  deriveStoreMarketCatalog,
  type StoreMarketCatalog,
} from '../lib/parseMarketDataKeys'

const EMPTY_CATALOG: StoreMarketCatalog = {
  keys: [],
  pairSymbols: [],
  cexSourceIds: [],
  dexNetworks: [],
  dexPools: [],
}

let cachedCatalog: StoreMarketCatalog | null = null
let loadPromise: Promise<StoreMarketCatalog> | null = null

export function getCachedStoreMarketCatalog(): StoreMarketCatalog | null {
  return cachedCatalog
}

export function getEmptyStoreMarketCatalog(): StoreMarketCatalog {
  return EMPTY_CATALOG
}

export async function loadStoreMarketCatalog(force = false): Promise<StoreMarketCatalog> {
  if (!force && cachedCatalog) return cachedCatalog
  if (!force && loadPromise) return loadPromise

  loadPromise = (async () => {
    const keys = await fetchStoreKeyCatalog(force)
    const catalog = deriveStoreMarketCatalog(keys)
    cachedCatalog = catalog
    return catalog
  })().finally(() => {
    loadPromise = null
  })

  return loadPromise
}

export function invalidateStoreMarketCatalog(): void {
  cachedCatalog = null
  invalidateStoreKeyCatalog()
}
