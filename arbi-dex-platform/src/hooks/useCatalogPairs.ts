import { useEffect, useState } from 'react'
import { getCachedCatalogPairSymbols, loadCatalogPairSymbols } from '../services/catalogService'

export function useCatalogPairs() {
  const [pairs, setPairs] = useState<string[]>(() => getCachedCatalogPairSymbols())
  const [loading, setLoading] = useState(() => pairs.length <= 6)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadCatalogPairSymbols()
      .then((next) => {
        if (!cancelled) setPairs(next)
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
