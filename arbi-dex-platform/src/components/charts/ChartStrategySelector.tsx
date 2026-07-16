import type { StrategyData } from '../../data/mockData'
import { cn } from '../../lib/utils'
import { Select } from '../ui/SearchInput'

/** Sentinel value for the raw chart view (no strategy overlay). */
export const CHART_STRATEGY_NONE = 'none'

interface ChartStrategySelectorProps {
  value: string
  onChange: (value: string) => void
  strategies: StrategyData[]
  className?: string
}

export function ChartStrategySelector({
  value,
  onChange,
  strategies,
  className,
}: ChartStrategySelectorProps) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <span className="text-xs text-muted shrink-0">Strategy</span>
      <Select
        value={value}
        onChange={onChange}
        options={[
          { value: CHART_STRATEGY_NONE, label: 'No Strategy' },
          ...strategies.map((strategy) => ({
            value: strategy.id,
            label: strategy.name,
          })),
        ]}
        className="min-w-[11rem] max-w-full text-sm"
      />
    </div>
  )
}
