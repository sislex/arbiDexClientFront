import { chartDateTime } from '../simulation/simulationFormatters'

const STORE_API_BASE = import.meta.env.VITE_STORE_API_BASE ?? '/market-api'

export interface PricePoint {
  key: string
  value: number
  timestamp: number
}

export type PriceSnapshot = Record<string, PricePoint>

export interface ChartPoint {
  t: number
  label: string
  xLabel?: string
  avg?: number
  [key: string]: number | string | undefined
}

function parsePositiveInt(raw: string | number | undefined, fallback: number): number {
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

export const FETCH_LIMIT = parsePositiveInt(import.meta.env.VITE_STORE_SERIES_LIMIT, 50000)
export const FETCH_TIMEOUT_MS = parsePositiveInt(import.meta.env.VITE_STORE_SERIES_TIMEOUT_MS, 15000)
export const CHART_POLL_INTERVAL_MS = parsePositiveInt(import.meta.env.VITE_CHART_POLL_INTERVAL_MS, 10000)

let cachedStoreKeyCatalog: string[] | null = null
let catalogLoadPromise: Promise<string[]> | null = null

export async function fetchStoreKeyCatalog(force = false): Promise<string[]> {
  if (!force && cachedStoreKeyCatalog) return cachedStoreKeyCatalog
  if (!force && catalogLoadPromise) return catalogLoadPromise

  catalogLoadPromise = (async () => {
    try {
      const res = await fetch(`${STORE_API_BASE}/store/keys`, {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      })
      if (!res.ok) return []
      const keys = (await res.json()) as unknown
      if (!Array.isArray(keys)) return []
      cachedStoreKeyCatalog = keys.filter((k): k is string => typeof k === 'string')
      return cachedStoreKeyCatalog
    } catch {
      return []
    } finally {
      catalogLoadPromise = null
    }
  })()

  return catalogLoadPromise
}

export function invalidateStoreKeyCatalog(): void {
  cachedStoreKeyCatalog = null
}

async function postStoreKeys(keys: string[], limit: number): Promise<Record<string, { points: { t: number; v: number }[] }> | null> {
  const noCacheUrl = `${STORE_API_BASE}/store/keys?_=${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const res = await fetch(noCacheUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    body: JSON.stringify({ keys, limit }),
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[store/keys]', res.status, detail.slice(0, 300))
    return null
  }
  const raw: Record<string, { points: { t: number; v: number }[] }> = await res.json()
  const hasAnyPoints = Object.values(raw).some((v) => (v?.points?.length ?? 0) > 0)
  return hasAnyPoints ? raw : null
}

export async function fetchLatestPrices(keys: string[]): Promise<PriceSnapshot> {
  const raw = await postStoreKeys(keys, 1)
  if (!raw) return {}
  const snapshot: PriceSnapshot = {}
  for (const [key, series] of Object.entries(raw)) {
    const last = series.points?.[series.points.length - 1]
    if (last) snapshot[key] = { key, value: last.v, timestamp: last.t }
  }
  return snapshot
}

export function calcMid(
  snapshot: PriceSnapshot,
  bidKey: string,
  askKey: string,
  transform: (v: number) => number = (v) => v,
): number | null {
  const bid = snapshot[bidKey]
  const ask = snapshot[askKey]
  if (!bid && !ask) return null
  if (bid && ask) return transform((bid.value + ask.value) / 2)
  return transform((bid ?? ask).value)
}

interface NetworkKeySource {
  id: string
  bidKey: string
  askKey: string
  transform: (v: number) => number
}

export async function fetchChartData(networks: readonly NetworkKeySource[]): Promise<ChartPoint[]> {
  const allKeys = networks.flatMap((n) => [n.bidKey, n.askKey])
  const limits = [...new Set([
    FETCH_LIMIT,
    Math.max(12000, Math.round(FETCH_LIMIT * 0.5)),
    Math.max(4000, Math.round(FETCH_LIMIT * 0.2)),
    1200,
  ])]

  let raw: Record<string, { points: { t: number; v: number }[] }> | null = null
  for (const limit of limits) {
    try {
      raw = await postStoreKeys(allKeys, limit)
      if (raw) break
    } catch {
      // try smaller limit
    }
  }
  if (!raw) return []

  interface TypedSeries {
    t: Float64Array
    v: Float64Array
    length: number
  }
  interface AlignedTypedSeries {
    values: Float64Array
    hasValue: Uint8Array
  }

  const toTypedSeries = (points: Array<{ t: number; v: number }>, transform: (v: number) => number): TypedSeries => {
    const tBuffer = new Float64Array(points.length)
    const vBuffer = new Float64Array(points.length)
    let len = 0
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]
      const t = Number(point?.t)
      const v = Number(point?.v)
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue
      tBuffer[len] = t
      vBuffer[len] = transform(v)
      len += 1
    }
    return { t: tBuffer, v: vBuffer, length: len }
  }

  const seriesMap: Record<string, TypedSeries> = {}
  for (const net of networks) {
    const bidPts = toTypedSeries(raw[net.bidKey]?.points ?? [], net.transform)
    const askPts = toTypedSeries(raw[net.askKey]?.points ?? [], net.transform)
    seriesMap[`${net.id}_buy`] = askPts
    seriesMap[`${net.id}_sell`] = bidPts
  }

  const allTs: number[] = []
  for (const series of Object.values(seriesMap)) {
    for (let i = 0; i < series.length; i += 1) {
      allTs.push(series.t[i])
    }
  }
  if (allTs.length === 0) return []
  const targetTs = [...new Set(allTs)].sort((a, b) => a - b)

  function carryForwardTyped(series: TypedSeries, sortedTargetTs: number[]): AlignedTypedSeries {
    const values = new Float64Array(sortedTargetTs.length)
    const hasValue = new Uint8Array(sortedTargetTs.length)
    let ptr = 0
    let last = 0
    let hasLast = false
    for (let i = 0; i < sortedTargetTs.length; i += 1) {
      const t = sortedTargetTs[i]
      while (ptr < series.length && series.t[ptr] <= t) {
        last = series.v[ptr]
        ptr += 1
        hasLast = true
      }
      if (hasLast) {
        values[i] = last
        hasValue[i] = 1
      }
    }
    return { values, hasValue }
  }

  const filled: Record<string, AlignedTypedSeries> = {}
  for (const [key, series] of Object.entries(seriesMap)) {
    filled[key] = carryForwardTyped(series, targetTs)
  }

  return targetTs.map((t, i) => {
    const point: ChartPoint = {
      t,
      label: new Date(t).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
      xLabel: chartDateTime(t),
    }

    for (const net of networks) {
      const buy = filled[`${net.id}_buy`]
      const sell = filled[`${net.id}_sell`]
      if (buy?.hasValue[i]) point[`${net.id}_buy`] = buy.values[i]
      if (sell?.hasValue[i]) point[`${net.id}_sell`] = sell.values[i]
    }

    const mids: number[] = []
    for (const net of networks) {
      const b = point[`${net.id}_buy`] as number | undefined
      const s = point[`${net.id}_sell`] as number | undefined
      if (b !== undefined && s !== undefined) mids.push((b + s) / 2)
      else if (b !== undefined) mids.push(b)
      else if (s !== undefined) mids.push(s)
    }
    if (mids.length > 0) point.avg = +(mids.reduce((a, b) => a + b, 0) / mids.length).toFixed(4)

    return point
  })
}
