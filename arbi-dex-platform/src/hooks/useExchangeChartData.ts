import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { referenceNetworks, resolveChartNetworks } from '../lib/buildChartNetworks'
import { applyReferenceAverage } from '../lib/chartPointAvg'
import {
  cacheCoversPeriod,
  CHART_POLL_OVERLAP_MS,
  CHART_POLL_TAIL_LIMIT,
  clearChartDataCache,
  getChartDataCache,
  mergeChartPoints,
  setChartDataCache,
} from '../lib/chartDataCache'
import { filterChartDataByPeriod, type ChartPeriod } from '../lib/chartTimeRange'
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

export function useExchangeChartData(
  selection: ChartPairSelection | undefined,
  period: ChartPeriod = '1h',
) {
  const selectionId = selection ? selectionKey(selection) : ''
  const cachedFull = selectionId ? getChartDataCache(selectionId) : undefined

  const [fullData, setFullData] = useState<ChartPoint[]>(() => cachedFull ?? [])
  const [networks, setNetworks] = useState<NetworkSource[]>([])
  const [loading, setLoading] = useState(() => !(cachedFull && cacheCoversPeriod(cachedFull, period)))
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const resolvedRef = useRef<NetworkSource[]>([])
  const fullDataRef = useRef(fullData)
  const periodRef = useRef(period)
  fullDataRef.current = fullData
  periodRef.current = period

  const data = useMemo(
    () => filterChartDataByPeriod(fullData, period),
    [fullData, period],
  )

  const referenceNets = useMemo(
    () => (selection ? referenceNetworks(selection, networks) : []),
    [selection, networks],
  )

  const commitFullData = useCallback(
    (next: ChartPoint[], cachePeriod: ChartPeriod) => {
      setFullData(next)
      if (selectionId) setChartDataCache(selectionId, next, cachePeriod)
    },
    [selectionId],
  )

  const reload = useCallback(() => {
    invalidateStoreKeyCatalog()
    if (selectionId) clearChartDataCache(selectionId)
    setFullData([])
    setRefreshToken((n) => n + 1)
  }, [selectionId])

  const fetchAndMerge = useCallback(
    async (
      resolved: NetworkSource[],
      fetchPeriod: ChartPeriod,
      options?: { limit?: number; sinceMs?: number },
    ): Promise<ChartPoint[]> => {
      const refNets = selection ? referenceNetworks(selection, resolved) : []
      const apiData = await fetchChartData(resolved, {
        period: fetchPeriod,
        keepBuffer: true,
        limit: options?.limit,
        sinceMs: options?.sinceMs,
      })
      if (apiData.length === 0) return fullDataRef.current
      const averaged = applyReferenceAverage(apiData, refNets)
      return mergeChartPoints(fullDataRef.current, averaged)
    },
    [selection],
  )

  useEffect(() => {
    if (!selection || selection.selectedExchanges.length === 0) {
      setFullData([])
      setNetworks([])
      setLoading(false)
      setError(null)
      resolvedRef.current = []
      return
    }

    let cancelled = false
    const cached = getChartDataCache(selectionId)
    if (cached?.length) {
      setFullData(cached)
      if (cacheCoversPeriod(cached, periodRef.current)) setLoading(false)
    }

    const bootstrap = async () => {
      const showLoading = !fullDataRef.current.length
      if (showLoading) setLoading(true)

      try {
        const catalog = await fetchStoreKeyCatalog()
        if (cancelled) return

        const resolved = resolveChartNetworks(selection, catalog)
        resolvedRef.current = resolved
        if (resolved.length === 0) {
          setNetworks([])
          setFullData([])
          setError(
            `Нет market-data для ${selection.pair} на выбранных биржах. Проверьте пару и адреса DEX.`,
          )
          return
        }

        setNetworks(resolved)

        if (cacheCoversPeriod(fullDataRef.current, periodRef.current)) {
          setError(null)
          return
        }

        const merged = await fetchAndMerge(resolved, periodRef.current)
        if (cancelled) return

        if (merged.length === 0) {
          setError('Store API не вернул историю цен для выбранных ключей.')
          return
        }

        commitFullData(merged, periodRef.current)
        setError(null)
      } catch {
        if (!cancelled && !fullDataRef.current.length) {
          setError('Не удалось загрузить данные графика из store API.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrap()

    const pollTimer = setInterval(async () => {
      const resolved = resolvedRef.current
      if (resolved.length === 0 || fullDataRef.current.length === 0) return

      try {
        const lastT = fullDataRef.current[fullDataRef.current.length - 1].t
        const merged = await fetchAndMerge(resolved, periodRef.current, {
          limit: CHART_POLL_TAIL_LIMIT,
          sinceMs: Math.max(0, lastT - CHART_POLL_OVERLAP_MS),
        })
        if (merged.length > fullDataRef.current.length) {
          commitFullData(merged, periodRef.current)
          setError(null)
        }
      } catch {
        // фоновое обновление
      }
    }, CHART_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(pollTimer)
    }
  }, [selection, selectionId, refreshToken, fetchAndMerge, commitFullData])

  useEffect(() => {
    if (!selection || selection.selectedExchanges.length === 0) return
    if (cacheCoversPeriod(fullDataRef.current, period)) {
      setLoading(false)
      return
    }

    let cancelled = false

    const extendForPeriod = async () => {
      const resolved = resolvedRef.current
      if (resolved.length === 0) return

      try {
        const merged = await fetchAndMerge(resolved, period)
        if (cancelled || merged.length === 0) return
        commitFullData(merged, period)
        setError(null)
      } catch {
        // оставляем уже загруженное
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setLoading(fullDataRef.current.length === 0)
    void extendForPeriod()

    return () => {
      cancelled = true
    }
  }, [period, selection, fetchAndMerge, commitFullData])

  return { data, fullData, loading, networks, referenceNets, error, reload }
}
