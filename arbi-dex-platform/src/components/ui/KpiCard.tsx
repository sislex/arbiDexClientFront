import { cn, formatCurrency, formatPercent } from '../../lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  change?: number
  suffix?: string
  icon?: React.ReactNode
  className?: string
}

export function KpiCard({ label, value, change, suffix, icon, className }: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0

  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] bg-card border border-border p-5 flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted font-medium">{label}</span>
        {icon && <div className="text-muted">{icon}</div>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold text-white tracking-tight">
          {typeof value === 'number' ? formatCurrency(value) : value}
          {suffix && <span className="text-lg text-muted ml-1">{suffix}</span>}
        </span>
        {change !== undefined && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-semibold',
              isPositive ? 'text-success' : 'text-error',
            )}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {formatPercent(change)}
          </span>
        )}
      </div>
    </div>
  )
}
