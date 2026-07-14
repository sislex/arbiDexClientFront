import { Select } from '../ui/SearchInput'
import {
  MONTH_OPTIONS,
  dateFromParts,
  getDayOptions,
  getYearOptions,
  toDateParts,
  type DateParts,
} from '../../lib/historicalRange'
import { cn } from '../../lib/utils'

interface DateDropdownGroupProps {
  label: string
  value: DateParts
  onChange: (value: DateParts) => void
  minYear?: number
  maxDate?: Date
  className?: string
}

export function DateDropdownGroup({
  label,
  value,
  onChange,
  minYear,
  maxDate = new Date(),
  className,
}: DateDropdownGroupProps) {
  const maxYear = maxDate.getFullYear()
  const yearOptions = getYearOptions(minYear, maxYear)
  const dayOptions = getDayOptions(value.year, value.month)

  const patch = (patchValue: Partial<DateParts>) => {
    const next = { ...value, ...patchValue }
    const clampedDay = Math.min(next.day, getDayOptions(next.year, next.month).length)
    onChange({ ...next, day: clampedDay })
  }

  const maxParts = toDateParts(maxDate)
  const monthLimit =
    value.year === maxParts.year ? maxParts.month : value.year < maxParts.year ? 12 : maxParts.month

  const monthOptions = MONTH_OPTIONS.filter((m) => Number(m.value) <= monthLimit)

  const dayLimit =
    value.year === maxParts.year && value.month === maxParts.month
      ? maxParts.day
      : getDayOptions(value.year, value.month).length

  const filteredDayOptions = dayOptions.filter((d) => Number(d.value) <= dayLimit)

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[11px] text-muted mb-1 block">День</label>
          <Select
            value={String(value.day)}
            onChange={(v) => patch({ day: Number(v) })}
            options={filteredDayOptions}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted mb-1 block">Месяц</label>
          <Select
            value={String(value.month)}
            onChange={(v) => patch({ month: Number(v) })}
            options={monthOptions}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted mb-1 block">Год</label>
          <Select
            value={String(value.year)}
            onChange={(v) => patch({ year: Number(v) })}
            options={yearOptions}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}

export function datePartsToInput(from: DateParts, to: DateParts) {
  const format = (parts: DateParts) => {
    const d = dateFromParts(parts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return { from: format(from), to: format(to) }
}
