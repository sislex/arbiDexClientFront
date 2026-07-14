import { cn } from '../../lib/utils'

export type FundMode = 'demo' | 'online'
export type TradeMode = 'auto' | 'manual'

export function FundModeToggle({
  mode,
  onChange,
}: {
  mode: FundMode
  onChange: (mode: FundMode) => void
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface p-1">
      <button
        type="button"
        onClick={() => onChange('demo')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          mode === 'demo' ? 'bg-warning/15 text-warning' : 'text-muted hover:text-foreground',
        )}
      >
        Demo
      </button>
      <button
        type="button"
        onClick={() => onChange('online')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          mode === 'online' ? 'bg-success/15 text-success' : 'text-muted hover:text-foreground',
        )}
      >
        Реальные деньги
      </button>
    </div>
  )
}

export function TradeModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: TradeMode
  onChange: (mode: TradeMode) => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-xl border border-border bg-surface p-1',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <button
        type="button"
        onClick={() => onChange('auto')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          mode === 'auto' ? 'bg-accent-purple/15 text-accent-purple' : 'text-muted hover:text-foreground',
        )}
      >
        Авто
      </button>
      <button
        type="button"
        onClick={() => onChange('manual')}
        className={cn(
          'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          mode === 'manual' ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-muted hover:text-foreground',
        )}
      >
        Ручная
      </button>
    </div>
  )
}
