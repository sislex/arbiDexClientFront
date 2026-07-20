import type { ChartPoint } from '../services/chartDataService'

export type ChartPeriod = '1h' | '1d' | '1w' | '1y'

/** Запас по времени при загрузке и отрисовке (40%) */
export const CHART_LOAD_BUFFER_FACTOR = 1.4

export const CHART_PERIOD_OPTIONS: { id: ChartPeriod; label: string; ms: number }[] = [
  { id: '1h', label: '1h', ms: 60 * 60 * 1000 },
  { id: '1d', label: '1d', ms: 24 * 60 * 60 * 1000 },
  { id: '1w', label: '1w', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '1y', label: '1year', ms: 365 * 24 * 60 * 60 * 1000 },
]

export function periodMs(period: ChartPeriod): number {
  return CHART_PERIOD_OPTIONS.find((p) => p.id === period)?.ms ?? CHART_PERIOD_OPTIONS[0].ms
}

/** Pick axis/window semantics from the actual loaded history span. */
export function inferChartPeriodFromSpan(spanMs: number): ChartPeriod {
  const day = 24 * 60 * 60 * 1000
  if (spanMs > 180 * day) return '1y'
  if (spanMs > 3 * day) return '1w'
  if (spanMs > 6 * 60 * 60 * 1000) return '1d'
  return '1h'
}

/** Точки в пределах выбранного периода от последней метки времени */
export function filterChartDataByPeriod(data: ChartPoint[], period: ChartPeriod): ChartPoint[] {
  if (data.length === 0) return []
  const end = data[data.length - 1].t
  const start = end - periodMs(period)
  const filtered = data.filter((p) => p.t >= start)
  return filtered.length > 0 ? filtered : data
}

/** Период + запас по времени для плавного сдвига у краёв */
export function filterChartDataWithBuffer(data: ChartPoint[], period: ChartPeriod): ChartPoint[] {
  if (data.length === 0) return []
  const end = data[data.length - 1].t
  const start = end - periodMs(period) * CHART_LOAD_BUFFER_FACTOR
  const filtered = data.filter((p) => p.t >= start)
  return filtered.length > 0 ? filtered : data
}

export function strictPeriodBounds(
  data: ChartPoint[],
  period: ChartPeriod,
): { min: number; max: number } {
  if (data.length === 0) return { min: 0, max: 0 }
  const end = data[data.length - 1].t
  return { min: end - periodMs(period), max: end }
}

export function formatChartAxisLabel(timestamp: number, period: ChartPeriod): string {
  const d = new Date(timestamp)
  if (period === '1h') {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  if (period === '1d') {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  if (period === '1w') {
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function formatChartTooltipLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function minViewportSpan(period: ChartPeriod, periodSpanMs: number): number {
  const floor =
    period === '1h'
      ? 60_000
      : period === '1d'
        ? 5 * 60_000
        : period === '1w'
          ? 30 * 60_000
          : 24 * 60 * 60_000
  return Math.min(floor, periodSpanMs * 0.02)
}

/** Сколько последних точек запрашивать у store API под выбранный период */
export function fetchLimitForPeriod(
  period: ChartPeriod,
  options?: { buffer?: boolean },
): number {
  const base =
    period === '1h'
      ? 4_000
      : period === '1d'
        ? 8_000
        : period === '1w'
          ? 12_000
          : 20_000

  if (options?.buffer) {
    return Math.ceil(base * 1.4)
  }
  return base
}

/** Максимум точек для Recharts (~2 px на точку) */
export function maxRenderPointsForWidth(widthPx: number): number {
  return Math.min(2_000, Math.max(300, Math.round(widthPx * 2)))
}

const CHART_POINT_META_KEYS = new Set(['t', 'label', 'xLabel'])

function chartPointValueSignature(point: ChartPoint): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(point)) {
    if (CHART_POINT_META_KEYS.has(key)) continue
    if (typeof value === 'number' && Number.isFinite(value)) {
      parts.push(`${key}:${value}`)
    }
  }
  parts.sort()
  return parts.join('|')
}

/** Дорисовка step-линий: протягиваем последнее известное значение вперёд */
export function forwardFillChartSeries(data: ChartPoint[]): ChartPoint[] {
  if (data.length === 0) return data

  const lastValues: Record<string, number> = {}
  const knownKeys = new Set<string>()

  return data.map((point) => {
    const next: ChartPoint = { ...point }

    for (const [key, value] of Object.entries(point)) {
      if (CHART_POINT_META_KEYS.has(key)) continue
      knownKeys.add(key)
      if (typeof value === 'number' && Number.isFinite(value)) {
        lastValues[key] = value
      }
    }

    for (const key of knownKeys) {
      const current = next[key]
      if ((current === undefined || current === null) && lastValues[key] !== undefined) {
        next[key] = lastValues[key]
      }
    }

    return next
  })
}

/** Прореживание для step-графика: сохраняем смены значений и хвосты bucket'ов */
export function downsampleChartPoints(data: ChartPoint[], maxPoints: number): ChartPoint[] {
  const filled = forwardFillChartSeries(data)
  if (filled.length <= maxPoints || maxPoints < 2) return filled

  const keep = new Set<number>([0, filled.length - 1])

  for (let i = 1; i < filled.length; i += 1) {
    if (chartPointValueSignature(filled[i]) !== chartPointValueSignature(filled[i - 1])) {
      keep.add(i)
      keep.add(i - 1)
    }
  }

  const bucketSize = (filled.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i += 1) {
    const idx =
      i === maxPoints - 1
        ? filled.length - 1
        : Math.min(filled.length - 1, Math.floor((i + 1) * bucketSize))
    keep.add(idx)
  }

  if (keep.size <= maxPoints) {
    return [...keep].sort((a, b) => a - b).map((index) => filled[index])
  }

  // Слишком много точек смены — равномерно оставляем maxPoints, но с forward-fill
  const stride = Math.ceil(filled.length / maxPoints)
  const result: ChartPoint[] = []
  for (let i = 0; i < filled.length; i += stride) {
    result.push(filled[i])
  }
  const last = filled[filled.length - 1]
  if (result[result.length - 1] !== last) result.push(last)
  return forwardFillChartSeries(result)
}

/** Позиция последней точки данных по ширине графика (2/3 слева, 1/3 — запас справа) */
export const CHART_LIVE_EDGE_RATIO = 2 / 3

/** Доля правого «живого» отступа (0 — линии на всю ширину, 1 — полная 1/3 пустоты). */
export function computeLiveEdgePaddingFactor(
  viewport: { start: number; end: number },
  bounds: { min: number; max: number },
): number {
  if (bounds.max <= bounds.min || viewport.end <= viewport.start) return 0

  const gapFromLive = Math.max(0, bounds.max - viewport.end)
  const viewportSpan = viewport.end - viewport.start
  const periodSpan = bounds.max - bounds.min
  const transitionSpan = Math.max(
    viewportSpan * ((1 - CHART_LIVE_EDGE_RATIO) / CHART_LIVE_EDGE_RATIO),
    periodSpan * 0.02,
    2_000,
  )

  if (gapFromLive >= transitionSpan) return 0
  return 1 - gapFromLive / transitionSpan
}

function rightPaddingMs(viewportSpan: number, paddingFactor: number): number {
  const factor = Math.min(1, Math.max(0, paddingFactor))
  return viewportSpan * ((1 - CHART_LIVE_EDGE_RATIO) / CHART_LIVE_EDGE_RATIO) * factor
}

/** Домен оси X: viewport + плавный правый запас (не зависит от длины данных). */
export function computeChartXDomain(
  viewport: { start: number; end: number },
  paddingFactor = 1,
): [number, number] {
  const axisMin = viewport.start
  if (viewport.end <= viewport.start) return [axisMin, viewport.end]

  const viewportSpan = viewport.end - viewport.start
  return [axisMin, viewport.end + rightPaddingMs(viewportSpan, paddingFactor)]
}

/** Доля ширины, где видны линии (2/3 при полном отступе, 1 при его отсутствии). */
export function computeChartLineClipRatio(
  viewport: { start: number; end: number },
  paddingFactor: number,
): number {
  const viewportSpan = viewport.end - viewport.start
  if (viewportSpan <= 0) return 1
  const domainSpan = viewportSpan + rightPaddingMs(viewportSpan, paddingFactor)
  return viewportSpan / domainSpan
}

/** Маркер ghost-точки в `label` (невидимое продолжение линии). */
export const CHART_GHOST_LABEL = '\x00ghost'

/** Невидимое продолжение step-линий до правого края домена — для эффекта сдвига при pan. */
export function extendDataWithGhostTail(data: ChartPoint[], axisMax: number): ChartPoint[] {
  if (data.length === 0) return data

  const last = data[data.length - 1]
  if (last.t >= axisMax) return data

  return [
    ...data,
    {
      ...last,
      t: axisMax,
      label: CHART_GHOST_LABEL,
    },
  ]
}

export function isChartGhostPoint(point: ChartPoint | undefined): boolean {
  return point?.label === CHART_GHOST_LABEL
}

/** Доля запаса сверху/снизу по оси Y (5–10%) */
export const CHART_Y_PADDING_RATIO = 0.08

function collectPriceValues(point: ChartPoint, dataKeys?: string[]): number[] {
  const values: number[] = []
  const keys =
    dataKeys && dataKeys.length > 0
      ? dataKeys
      : Object.keys(point).filter((key) => !CHART_POINT_META_KEYS.has(key))

  for (const key of keys) {
    const value = point[key]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      values.push(value)
    }
  }
  return values
}

/** Вертикальный диапазон с запасом, чтобы мелкие колебания были видны */
export function computeYDomainWithPadding(
  data: ChartPoint[],
  dataKeys?: string[],
  paddingRatio = CHART_Y_PADDING_RATIO,
): [number, number] | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const point of data) {
    for (const value of collectPriceValues(point, dataKeys)) {
      if (value < min) min = value
      if (value > max) max = value
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null

  if (min === max) {
    const basePad = Math.max(Math.abs(min) * 0.01, 1e-6)
    return [min - basePad, max + basePad]
  }

  const span = max - min
  const pad = span * paddingRatio
  return [min - pad, max + pad]
}

/** Nearest chart point → 1-based playIdx (playIdx 1 = first point). */
export function findPlayIdxByTimestamp<T extends { t: number }>(
  points: readonly T[],
  time: number,
): number {
  if (points.length === 0) return 0
  let bestIdx = 0
  let bestDist = Math.abs(points[0].t - time)
  for (let i = 1; i < points.length; i += 1) {
    const dist = Math.abs(points[i].t - time)
    if (dist < bestDist) {
      bestIdx = i
      bestDist = dist
    }
  }
  return bestIdx + 1
}
