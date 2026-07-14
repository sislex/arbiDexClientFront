export type HistoricalRangePreset = '24h' | '7d' | '30d' | '90d' | 'custom'

export const HISTORICAL_RANGE_OPTIONS: { value: HistoricalRangePreset; label: string }[] = [
  { value: '24h', label: '24 часа' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
  { value: 'custom', label: 'Свой период' },
]

export const MONTH_OPTIONS = [
  { value: '1', label: 'Январь' },
  { value: '2', label: 'Февраль' },
  { value: '3', label: 'Март' },
  { value: '4', label: 'Апрель' },
  { value: '5', label: 'Май' },
  { value: '6', label: 'Июнь' },
  { value: '7', label: 'Июль' },
  { value: '8', label: 'Август' },
  { value: '9', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' },
]

export interface HistoricalRange {
  preset: HistoricalRangePreset
  from: Date
  to: Date
}

export interface DateParts {
  day: number
  month: number
  year: number
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function parseHistoricalPreset(value: string | null): HistoricalRangePreset {
  if (value === '7d' || value === '30d' || value === '90d' || value === 'custom') return value
  return '24h'
}

export function toDateParts(date: Date): DateParts {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function dateFromParts(parts: DateParts): Date {
  const maxDay = daysInMonth(parts.year, parts.month)
  const day = Math.min(Math.max(1, parts.day), maxDay)
  return startOfDay(new Date(parts.year, parts.month - 1, day))
}

export function getYearOptions(minYear?: number, maxYear?: number) {
  const max = maxYear ?? new Date().getFullYear()
  const min = minYear ?? max - 5
  const years: number[] = []
  for (let y = max; y >= min; y -= 1) years.push(y)
  return years.map((y) => ({ value: String(y), label: String(y) }))
}

export function getDayOptions(year: number, month: number) {
  const total = daysInMonth(year, month)
  return Array.from({ length: total }, (_, i) => {
    const day = i + 1
    return { value: String(day), label: String(day).padStart(2, '0') }
  })
}

export function resolveHistoricalRange(
  preset: HistoricalRangePreset,
  fromParam?: string | null,
  toParam?: string | null,
): HistoricalRange {
  const now = new Date()
  const to = toParam ? startOfDay(new Date(toParam)) : now

  if (preset === 'custom' && fromParam) {
    return {
      preset,
      from: startOfDay(new Date(fromParam)),
      to: startOfDay(toParam ? new Date(toParam) : now),
    }
  }

  const from = new Date(to)
  switch (preset) {
    case '7d':
      from.setDate(from.getDate() - 7)
      break
    case '30d':
      from.setDate(from.getDate() - 30)
      break
    case '90d':
      from.setDate(from.getDate() - 90)
      break
    default:
      from.setHours(from.getHours() - 24)
      break
  }

  return { preset, from, to }
}

export function formatHistoricalRangeLabel(range: HistoricalRange): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: range.preset === '24h' ? undefined : 'numeric',
    })

  if (range.preset === '24h') {
    return `${fmt(range.from)} ${range.from.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — ${range.to.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  }

  return `${fmt(range.from)} — ${fmt(range.to)}`
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isCustomRangeValid(from: DateParts, to: DateParts): boolean {
  const fromDate = dateFromParts(from)
  const toDate = dateFromParts(to)
  const today = startOfDay(new Date())
  return fromDate.getTime() <= toDate.getTime() && toDate.getTime() <= today.getTime()
}
