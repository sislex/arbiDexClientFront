import type { ChartPoint } from '../services/chartDataService'
import {
  CHART_LOAD_BUFFER_FACTOR,
  fetchLimitForPeriod,
  periodMs,
  type ChartPeriod,
} from './chartTimeRange'

/** Запас по времени и объёму точек при загрузке — см. CHART_LOAD_BUFFER_FACTOR */
export { CHART_LOAD_BUFFER_FACTOR }
export const CHART_POLL_TAIL_LIMIT = 400
export const CHART_POLL_OVERLAP_MS = 5 * 60 * 1000

interface ChartDataCacheEntry {
  data: ChartPoint[]
  updatedAt: number
}

const cache = new Map<string, ChartDataCacheEntry>()

function maxCachePoints(period: ChartPeriod): number {
  return Math.ceil(fetchLimitForPeriod(period, { buffer: true }) * 1.25)
}

export function getChartDataCache(key: string): ChartPoint[] | undefined {
  return cache.get(key)?.data
}

export function setChartDataCache(key: string, data: ChartPoint[], period: ChartPeriod): void {
  if (data.length === 0) return
  const cap = maxCachePoints(period)
  cache.set(key, {
    data: data.length > cap ? data.slice(data.length - cap) : data,
    updatedAt: Date.now(),
  })
}

export function clearChartDataCache(key?: string): void {
  if (key) cache.delete(key)
  else cache.clear()
}

export function mergeChartPoints(base: ChartPoint[], incoming: ChartPoint[]): ChartPoint[] {
  if (incoming.length === 0) return base
  if (base.length === 0) return incoming

  const map = new Map<number, ChartPoint>()
  for (const point of base) map.set(point.t, point)
  for (const point of incoming) map.set(point.t, point)

  return [...map.values()].sort((a, b) => a.t - b.t)
}

/** Достаточно ли кэша для выбранного периода (с небольшим запасом слева) */
export function cacheCoversPeriod(data: ChartPoint[], period: ChartPeriod): boolean {
  if (data.length < 2) return false
  const end = data[data.length - 1].t
  const requiredStart = end - periodMs(period)
  const tolerance = periodMs(period) * 0.08
  return data[0].t <= requiredStart + tolerance
}

export function fetchLimitWithBuffer(period: ChartPeriod): number {
  return fetchLimitForPeriod(period, { buffer: true })
}

export function bufferedSinceMs(latestT: number, period: ChartPeriod): number {
  if (latestT <= 0) return 0
  return latestT - periodMs(period) * CHART_LOAD_BUFFER_FACTOR
}
