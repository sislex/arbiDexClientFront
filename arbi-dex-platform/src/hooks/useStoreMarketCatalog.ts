import { useEffect, useState } from 'react'
import type { StoreMarketCatalog } from '../lib/parseMarketDataKeys'
import {
  getCachedStoreMarketCatalog,
  getEmptyStoreMarketCatalog,
  loadStoreMarketCatalog,
} from '../services/storeMarketCatalog'

export function useStoreMarketCatalog() {
  const cached = getCachedStoreMarketCatalog()
  const [catalog, setCatalog] = useState<StoreMarketCatalog>(
    () => cached ?? getEmptyStoreMarketCatalog(),
  )
  const [loading, setLoading] = useState(() => !cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadStoreMarketCatalog()
      .then((next) => {
        if (!cancelled) setCatalog(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить store keys')
          setCatalog(getEmptyStoreMarketCatalog())
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { catalog, loading, error }
}
