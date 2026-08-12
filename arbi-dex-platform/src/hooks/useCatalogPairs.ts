import { useEffect, useState } from 'react'
import {
  getCachedStoreMarketCatalog,
  loadStoreMarketCatalog,
} from '../services/storeMarketCatalog'

export function useCatalogPairs() {
  const cached = getCachedStoreMarketCatalog()?.pairSymbols ?? []
  const [pairs, setPairs] = useState<string[]>(cached)
  const [loading, setLoading] = useState(() => cached.length === 0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadStoreMarketCatalog()
      .then((catalog) => {
        if (!cancelled) setPairs(catalog.pairSymbols)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { pairs, loading }
}
