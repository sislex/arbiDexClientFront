import { useEffect, useRef, useState } from 'react'
import type { EditableExcludedRange } from './excludedRanges'

const STORAGE_PREFIX = 'arbidex-excluded-ranges-'
const TTL_MS = 4 * 60 * 60 * 1000

interface StoredExcludedRanges {
  savedAt: number
  ranges: EditableExcludedRange[]
}

function storageKey(chartId: string): string {
  return `${STORAGE_PREFIX}${chartId}`
}

function isValidRange(value: unknown): value is EditableExcludedRange {
  if (!value || typeof value !== 'object') return false
  const r = value as Partial<EditableExcludedRange>
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    typeof r.start === 'number' &&
    Number.isFinite(r.start) &&
    typeof r.end === 'number' &&
    Number.isFinite(r.end)
  )
}

function parseStored(raw: string): EditableExcludedRange[] | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredExcludedRanges>
    if (!parsed || typeof parsed.savedAt !== 'number' || !Array.isArray(parsed.ranges)) {
      return null
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      return null
    }
    const ranges = parsed.ranges.filter(isValidRange)
    return ranges
  } catch {
    return null
  }
}

export function loadExcludedRanges(chartId: string): EditableExcludedRange[] {
  if (typeof window === 'undefined' || !chartId) return []
  try {
    const raw = localStorage.getItem(storageKey(chartId))
    if (!raw) return []
    const ranges = parseStored(raw)
    if (ranges === null) {
      localStorage.removeItem(storageKey(chartId))
      return []
    }
    return ranges
  } catch {
    return []
  }
}

export function saveExcludedRanges(chartId: string, ranges: EditableExcludedRange[]): void {
  if (typeof window === 'undefined' || !chartId) return
  try {
    if (ranges.length === 0) {
      localStorage.removeItem(storageKey(chartId))
      return
    }
    const payload: StoredExcludedRanges = {
      savedAt: Date.now(),
      ranges,
    }
    localStorage.setItem(storageKey(chartId), JSON.stringify(payload))
  } catch {
    // ignore quota / private mode errors
  }
}

/** Исключённые диапазоны графика: localStorage на 4 ч, отдельный ключ на каждый chartId (bot.id). */
export function usePersistedExcludedRanges(chartId: string) {
  const [ranges, setRanges] = useState<EditableExcludedRange[]>(() => loadExcludedRanges(chartId))
  const chartIdRef = useRef(chartId)

  useEffect(() => {
    if (chartIdRef.current !== chartId) {
      chartIdRef.current = chartId
      setRanges(loadExcludedRanges(chartId))
      return
    }
    saveExcludedRanges(chartId, ranges)
  }, [chartId, ranges])

  return [ranges, setRanges] as const
}
