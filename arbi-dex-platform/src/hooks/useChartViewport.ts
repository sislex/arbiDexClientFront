import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { ChartPoint } from '../services/chartDataService'
import { minViewportSpan, downsampleChartPoints, computeChartXDomain, computeLiveEdgePaddingFactor, computeChartLineClipRatio, extendDataWithGhostTail, maxRenderPointsForWidth, forwardFillChartSeries, type ChartPeriod } from '../lib/chartTimeRange'

export interface ChartViewportBounds {
  min: number
  max: number
}

export interface ChartViewport {
  start: number
  end: number
}

function clampViewport(
  start: number,
  end: number,
  panBounds: ChartViewportBounds,
  periodBounds: ChartViewportBounds,
  period: ChartPeriod,
): ChartViewport {
  const panSpan = panBounds.max - panBounds.min
  const periodSpan = periodBounds.max - periodBounds.min
  if (panSpan <= 0 || periodSpan <= 0) {
    return { start: periodBounds.min, end: periodBounds.max }
  }

  const minSpan = minViewportSpan(period, periodSpan)
  let span = Math.max(minSpan, end - start)
  span = Math.min(span, periodSpan)

  let nextStart = start
  let nextEnd = start + span

  if (nextStart < panBounds.min) {
    nextStart = panBounds.min
    nextEnd = nextStart + span
  }
  if (nextEnd > panBounds.max) {
    nextEnd = panBounds.max
    nextStart = nextEnd - span
  }
  if (nextStart < panBounds.min) nextStart = panBounds.min

  return { start: nextStart, end: nextEnd }
}

function liveEdgeTolerance(viewport: ChartViewport, bounds: ChartViewportBounds): number {
  const span = viewport.end - viewport.start
  const periodSpan = bounds.max - bounds.min
  return Math.max(span * 0.02, periodSpan * 0.005, 3_000)
}

function isAtLiveEdge(viewport: ChartViewport, bounds: ChartViewportBounds): boolean {
  if (bounds.max <= bounds.min) return true
  return viewport.end >= bounds.max - liveEdgeTolerance(viewport, bounds)
}

function isDefaultPeriodView(viewport: ChartViewport, periodBounds: ChartViewportBounds): boolean {
  const periodSpan = periodBounds.max - periodBounds.min
  if (periodSpan <= 0) return true
  const span = viewport.end - viewport.start
  return span >= periodSpan * 0.98 && Math.abs(viewport.start - periodBounds.min) < periodSpan * 0.01
}

export function useChartViewport(
  periodData: ChartPoint[],
  period: ChartPeriod,
  periodBounds?: { min: number; max: number },
  options?: { containerRef?: RefObject<HTMLDivElement | null> },
) {
  const internalContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = options?.containerRef ?? internalContainerRef

  const panBounds = useMemo<ChartViewportBounds>(() => {
    if (periodData.length === 0) return { min: 0, max: 0 }
    return { min: periodData[0].t, max: periodData[periodData.length - 1].t }
  }, [periodData])

  const defaultBounds = useMemo<ChartViewportBounds>(() => {
    if (periodBounds && periodBounds.max > periodBounds.min) {
      return periodBounds
    }
    return panBounds
  }, [periodBounds, panBounds])

  const [viewport, setViewport] = useState<ChartViewport>(() => ({
    start: defaultBounds.min,
    end: defaultBounds.max,
  }))
  const prevPeriodRef = useRef(period)
  const prevDefaultBoundsRef = useRef<ChartViewportBounds>(defaultBounds)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? node.clientWidth
      if (width > 0) setContainerWidth(width)
    })
    observer.observe(node)
    setContainerWidth(node.clientWidth || 800)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (prevPeriodRef.current !== period) {
      prevPeriodRef.current = period
      prevDefaultBoundsRef.current = defaultBounds
      setViewport({ start: defaultBounds.min, end: defaultBounds.max })
      return
    }

    const previousDefault = prevDefaultBoundsRef.current
    prevDefaultBoundsRef.current = defaultBounds

    setViewport((prev) => {
      if (defaultBounds.max <= defaultBounds.min) return prev

      const span = prev.end - prev.start

      if (isDefaultPeriodView(prev, previousDefault)) {
        return { start: defaultBounds.min, end: defaultBounds.max }
      }

      if (isAtLiveEdge(prev, previousDefault)) {
        return clampViewport(defaultBounds.max - span, defaultBounds.max, panBounds, defaultBounds, period)
      }

      if (prev.end > panBounds.max || prev.start < panBounds.min) {
        return clampViewport(prev.start, prev.end, panBounds, defaultBounds, period)
      }

      return prev
    })
  }, [defaultBounds.min, defaultBounds.max, panBounds.min, panBounds.max, period])

  const visibleData = useMemo(() => {
    if (periodData.length === 0) return []
    return periodData.filter((p) => p.t >= viewport.start && p.t <= viewport.end)
  }, [periodData, viewport.end, viewport.start])

  const paddingFactor = useMemo(
    () => computeLiveEdgePaddingFactor(viewport, defaultBounds),
    [viewport, defaultBounds],
  )

  const xDomain = useMemo(
    (): [number, number] => computeChartXDomain(viewport, paddingFactor),
    [viewport, paddingFactor],
  )

  const lineClipRatio = useMemo(
    () => computeChartLineClipRatio(viewport, paddingFactor),
    [viewport, paddingFactor],
  )

  const renderData = useMemo(() => {
    const filled = forwardFillChartSeries(visibleData)
    return downsampleChartPoints(filled, maxRenderPointsForWidth(containerWidth))
  }, [visibleData, containerWidth])

  const ghostRenderData = useMemo(
    () => extendDataWithGhostTail(renderData, xDomain[1]),
    [renderData, xDomain],
  )

  const isAdjusted = useMemo(() => {
    const periodSpan = defaultBounds.max - defaultBounds.min
    if (periodSpan <= 0) return false
    const span = viewport.end - viewport.start
    return (
      span < periodSpan * 0.98 ||
      viewport.start > defaultBounds.min + periodSpan * 0.01 ||
      viewport.end < defaultBounds.max - periodSpan * 0.01
    )
  }, [defaultBounds.max, defaultBounds.min, viewport.end, viewport.start])

  const reset = useCallback(() => {
    setViewport({ start: defaultBounds.min, end: defaultBounds.max })
  }, [defaultBounds.max, defaultBounds.min])

  const zoomAt = useCallback(
    (factor: number, centerRatio: number) => {
      if (defaultBounds.max <= defaultBounds.min) return
      setViewport((prev) => {
        const periodSpan = defaultBounds.max - defaultBounds.min
        const span = prev.end - prev.start
        if (factor < 1 && span >= periodSpan * 0.995) {
          return prev
        }
        const center = prev.start + span * centerRatio
        const nextSpan = span / factor
        const nextStart = center - nextSpan * centerRatio
        const nextEnd = nextStart + nextSpan
        return clampViewport(nextStart, nextEnd, panBounds, defaultBounds, period)
      })
    },
    [defaultBounds, panBounds, period],
  )

  const panningRef = useRef<{ startX: number; startViewport: ChartViewport } | null>(null)

  const handleWheelNative = useCallback(
    (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.ctrlKey) {
        const rect = containerRef.current?.getBoundingClientRect()
        const ratio =
          rect && rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5
        zoomAt(event.deltaY > 0 ? 1 / 1.12 : 1.12, Math.min(1, Math.max(0, ratio)))
        return
      }

      if (event.deltaY > 0) {
        zoomAt(1 / 1.12, 0.5)
        return
      }
      const rect = containerRef.current?.getBoundingClientRect()
      const ratio = rect && rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5
      zoomAt(1.12, Math.min(1, Math.max(0, ratio)))
    },
    [zoomAt],
  )

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    node.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => node.removeEventListener('wheel', handleWheelNative)
  }, [handleWheelNative])

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handlePanStart = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      panningRef.current = { startX: event.clientX, startViewport: viewport }
    },
    [viewport],
  )

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const pan = panningRef.current
      if (!pan) return
      const width = containerRef.current?.clientWidth ?? window.innerWidth
      if (width <= 0) return
      const deltaRatio = -(event.clientX - pan.startX) / width
      const span = pan.startViewport.end - pan.startViewport.start
      const delta = span * deltaRatio
      setViewport(clampViewport(
        pan.startViewport.start + delta,
        pan.startViewport.end + delta,
        panBounds,
        defaultBounds,
        period,
      ))
    }

    const onUp = () => {
      panningRef.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [defaultBounds, panBounds, period])

  const zoomByButton = useCallback(
    (zoomIn: boolean) => {
      zoomAt(zoomIn ? 1.12 : 1 / 1.12, 0.5)
    },
    [zoomAt],
  )

  const panByButton = useCallback(
    (direction: -1 | 1) => {
      setViewport((prev) => {
        const span = prev.end - prev.start
        const delta = span * 0.15 * direction
        return clampViewport(prev.start + delta, prev.end + delta, panBounds, defaultBounds, period)
      })
    },
    [defaultBounds, panBounds, period],
  )

  const centerOnTimestamp = useCallback(
    (ts: number) => {
      setViewport((prev) => {
        const span = prev.end - prev.start
        const half = span / 2
        return clampViewport(ts - half, ts + half, panBounds, defaultBounds, period)
      })
    },
    [defaultBounds, panBounds, period],
  )

  return {
    bounds: defaultBounds,
    viewport,
    xDomain,
    lineClipRatio,
    visibleData,
    renderData,
    ghostRenderData,
    isAdjusted,
    reset,
    zoomByButton,
    panByButton,
    centerOnTimestamp,
    handleWheel,
    handlePanStart,
    containerRef,
  }
}
