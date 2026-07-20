import { useCallback, useEffect, useState } from 'react'
import { fetchBotHistoryRange } from '../services/botsApi'

/** Timestamp is in ms when it is far larger than any plausible epoch-seconds value. */
const isMsUnit = (t: number): boolean => t > 1e12

export type ChartPeriodPickMode = 'idle' | 'from' | 'to'

export function useBotPeriod(botId: string | undefined) {
  const [range, setRange] = useState<{ historyFrom: number; historyTo: number } | null>(null)
  const [from, setFromState] = useState<number | null>(null)
  const [to, setToState] = useState<number | null>(null)

  useEffect(() => {
    if (!botId) return
    let alive = true
    fetchBotHistoryRange(botId)
      .then((r) => {
        if (!alive) return
        setRange(r)
        const week = isMsUnit(r.historyTo) ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600
        setToState(r.historyTo)
        setFromState(Math.max(r.historyFrom, r.historyTo - week))
      })
      .catch(() => {
        /* history unavailable — server falls back to default period */
      })
    return () => {
      alive = false
    }
  }, [botId])

  const unitMs = isMsUnit(range?.historyTo ?? from ?? to ?? 0)
  const HOUR = unitMs ? 3600 * 1000 : 3600
  const DAY = unitMs ? 24 * 3600 * 1000 : 24 * 3600
  const WEEK = unitMs ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600
  const MONTH = Math.round(WEEK * (30 / 7))

  const applyRange = useCallback((r: { historyFrom: number; historyTo: number }): void => {
    setRange(r)
    setFromState((f) => {
      if (f == null) return Math.max(r.historyFrom, r.historyTo - WEEK)
      return Math.min(Math.max(f, r.historyFrom), r.historyTo)
    })
    setToState((t) => {
      if (t == null) return r.historyTo
      return Math.min(Math.max(t, r.historyFrom), r.historyTo)
    })
  }, [WEEK])

  const effectiveBounds = useCallback((): { historyFrom: number; historyTo: number } | null => {
    if (range) return range
    if (from != null && to != null) return { historyFrom: Math.min(from, to), historyTo: Math.max(from, to) }
    return null
  }, [from, range, to])

  const setPreset = useCallback(
    (span: number | 'all'): void => {
      const bounds = effectiveBounds()
      if (!bounds) return
      if (span === 'all') {
        setFromState(bounds.historyFrom)
        setToState(bounds.historyTo)
      } else {
        setToState(bounds.historyTo)
        setFromState(Math.max(bounds.historyFrom, bounds.historyTo - span))
      }
    },
    [effectiveBounds],
  )

  const toMs = (t: number): number => (unitMs ? t : t * 1000)
  const toData = (ms: number): number => (unitMs ? ms : Math.round(ms / 1000))
  const pad = (n: number): string => String(n).padStart(2, '0')
  const dateStr = (t: number | null): string => {
    if (t == null) return ''
    const d = new Date(toMs(t))
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const parseDate = (str: string): number | null => {
    if (!str) return null
    const ms = Date.parse(str)
    if (Number.isNaN(ms)) return null
    const t = toData(ms)
    const bounds = effectiveBounds()
    if (!bounds) return t
    return Math.min(Math.max(t, bounds.historyFrom), bounds.historyTo)
  }

  const setFrom = useCallback(
    (value: number | null | ((prev: number | null) => number | null)) => {
      setFromState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value
        if (next == null) return null
        const bounds = effectiveBounds()
        if (!bounds) return next
        return Math.min(Math.max(next, bounds.historyFrom), bounds.historyTo)
      })
    },
    [effectiveBounds],
  )

  const setTo = useCallback(
    (value: number | null | ((prev: number | null) => number | null)) => {
      setToState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value
        if (next == null) return null
        const bounds = effectiveBounds()
        if (!bounds) return next
        return Math.min(Math.max(next, bounds.historyFrom), bounds.historyTo)
      })
    },
    [effectiveBounds],
  )

  return {
    range,
    from,
    to,
    setFrom,
    setTo,
    setPreset,
    applyRange,
    dateStr,
    parseDate,
    HOUR,
    DAY,
    WEEK,
    MONTH,
  }
}

export type BotPeriodState = ReturnType<typeof useBotPeriod>
