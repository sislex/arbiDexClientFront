import { useCallback, useEffect, useMemo, useState } from 'react'
import { referenceNetworks, resolveChartNetworks } from '../lib/buildChartNetworks'
import { applyReferenceAverage } from '../lib/chartPointAvg'
import {
  fetchChartData,
  fetchStoreKeyCatalog,
  invalidateStoreKeyCatalog,
  CHART_POLL_INTERVAL_MS,
  type ChartPoint,
} from '../services/chartDataService'
import type { NetworkSource } from '../simulation/simulationNetworkTypes'
import type { ChartPairSelection } from '../types/chart'

function selectionKey(selection: ChartPairSelection): string {
  return [
    selection.id,
    selection.pair,
    selection.purpose,
    selection.tradingExchange ?? '',
    selection.selectedExchanges.join(','),
    JSON.stringify(selection.dexEntries ?? []),
    JSON.stringify(selection.dexAddresses ?? {}),
  ].join('|')
}

export function useExchangeChartData(selection: ChartPairSelection | undefined) {
  const [data, setData] = useState<ChartPoint[]>([])
  const [networks, setNetworks] = useState<NetworkSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const selectionId = selection ? selectionKey(selection) : ''

  const referenceNets = useMemo(
    () => (selection ? referenceNetworks(selection, networks) : []),
    [selection, networks],
  )

  const reload = useCallback(() => {
    invalidateStoreKeyCatalog()
    setRefreshToken((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!selection || selection.selectedExchanges.length === 0) {
      setData([])
      setNetworks([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const load = async (showLoading: boolean) => {
      if (showLoading) setLoading(true)

      try {
        const catalog = await fetchStoreKeyCatalog()
        if (cancelled) return

        const resolved = resolveChartNetworks(selection, catalog)
        if (resolved.length === 0) {
          setNetworks([])
          setData([])
          setError(
            `Нет market-data для ${selection.pair} на выбранных биржах. Проверьте пару и адреса DEX.`,
          )
          return
        }

        const apiData = await fetchChartData(resolved)
        if (cancelled) return

        if (apiData.length === 0) {
          setNetworks(resolved)
          setData([])
          setError('Store API не вернул историю цен для выбранных ключей.')
          return
        }

        const refNets = referenceNetworks(selection, resolved)
        setNetworks(resolved)
        setData(applyReferenceAverage(apiData, refNets))
        setError(null)
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить данные графика из store API.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load(true)
    pollTimer = setInterval(() => {
      void load(false)
    }, CHART_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [selection, selectionId, refreshToken])

  return { data, loading, networks, referenceNets, error, reload }
}
