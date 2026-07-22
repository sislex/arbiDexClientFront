import type { MarketStep } from '@sislex/arbi-conditions-libs';

export interface ExcludedRange {
  start: number;
  end: number;
}

function toFinite(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readRange(raw: unknown): ExcludedRange | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const start = toFinite(rec.start);
  const end = toFinite(rec.end);
  if (start == null || end == null) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

export function parseExcludedRanges(raw: unknown): ExcludedRange[] {
  let input: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      input = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(input)) return [];
  const ranges = input
    .map((item) => readRange(item))
    .filter((item): item is ExcludedRange => item != null);
  return normalizeExcludedRanges(ranges);
}

export function normalizeExcludedRanges(ranges: ExcludedRange[]): ExcludedRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: ExcludedRange[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= prev.end) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function isTimeExcluded(time: number, ranges: ExcludedRange[]): ExcludedRange | null {
  for (const range of ranges) {
    if (time >= range.start && time <= range.end) return range;
  }
  return null;
}

export function filterStepsByExcludedRanges(steps: MarketStep[], ranges: ExcludedRange[]): MarketStep[] {
  if (ranges.length === 0) return steps;
  return steps.filter((step) => !isTimeExcluded(step.time, ranges));
}
