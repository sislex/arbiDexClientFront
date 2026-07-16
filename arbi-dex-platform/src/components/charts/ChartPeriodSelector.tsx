import { Maximize2 } from 'lucide-react'
import { CHART_PERIOD_OPTIONS, type ChartPeriod } from '../../lib/chartTimeRange'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

interface ChartPeriodSelectorProps {
  period: ChartPeriod
  onChange: (period: ChartPeriod) => void
  onReset: () => void
  showReset: boolean
  className?: string
}

export function ChartPeriodSelector({
  period,
  onChange,
  onReset,
  showReset,
  className,
}: ChartPeriodSelectorProps) {
  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      <div className="inline-flex rounded-lg border border-border bg-surface/60 p-0.5">
        {CHART_PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              period === opt.id
                ? 'bg-accent-purple text-white'
                : 'text-muted hover:text-white hover:bg-white/5',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showReset && (
        <Button variant="outline" size="sm" onClick={onReset} title="Показать весь период">
          <Maximize2 size={14} />
          Сброс
        </Button>
      )}
    </div>
  )
}
