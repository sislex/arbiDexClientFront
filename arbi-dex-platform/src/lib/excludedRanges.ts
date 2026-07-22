import type { ExcludedTimeRange } from '../services/botsApi'

export interface EditableExcludedRange extends ExcludedTimeRange {
  id: string
}

export function normalizeRange(start: number, end: number): ExcludedTimeRange {
  return start <= end ? { start, end } : { start: end, end: start }
}

export function isTimeInExcludedRanges(time: number, ranges: ExcludedTimeRange[]): boolean {
  return ranges.some((r) => time >= r.start && time <= r.end)
}

export function toServerExcludedRanges(ranges: EditableExcludedRange[]): ExcludedTimeRange[] {
  return ranges.map((r) => ({ start: r.start, end: r.end }))
}
