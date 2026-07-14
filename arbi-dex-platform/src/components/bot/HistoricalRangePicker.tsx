import { CalendarRange } from 'lucide-react'
import { Button } from '../ui/Button'
import { Select } from '../ui/SearchInput'
import { DateDropdownGroup, datePartsToInput } from './DateDropdownGroup'
import {
  HISTORICAL_RANGE_OPTIONS,
  toDateParts,
  type HistoricalRange,
  type HistoricalRangePreset,
} from '../../lib/historicalRange'
import { cn } from '../../lib/utils'

interface HistoricalRangePickerProps {
  range: HistoricalRange
  onPresetChange: (preset: HistoricalRangePreset) => void
  onCustomDatesChange: (from: string, to: string) => void
  onOpenForm?: () => void
  className?: string
}

export function HistoricalRangePicker({
  range,
  onPresetChange,
  onCustomDatesChange,
  onOpenForm,
  className,
}: HistoricalRangePickerProps) {
  const fromParts = toDateParts(range.from)
  const toParts = toDateParts(range.to)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <CalendarRange size={16} className="shrink-0 text-muted" />
      {onOpenForm ? (
        <Button variant="outline" size="sm" onClick={onOpenForm}>
          Изменить период
        </Button>
      ) : (
        <>
          <Select
            value={range.preset}
            onChange={(value) => onPresetChange(value as HistoricalRangePreset)}
            options={HISTORICAL_RANGE_OPTIONS}
            className="w-36"
          />
          {range.preset === 'custom' && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface px-3 py-2">
              <DateDropdownGroup
                label="С"
                value={fromParts}
                onChange={(next) => onCustomDatesChange(datePartsToInput(next, toParts).from, datePartsToInput(fromParts, toParts).to)}
                className="min-w-[200px]"
              />
              <span className="text-muted pb-2">—</span>
              <DateDropdownGroup
                label="По"
                value={toParts}
                onChange={(next) => onCustomDatesChange(datePartsToInput(fromParts, next).from, datePartsToInput(fromParts, next).to)}
                className="min-w-[200px]"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
