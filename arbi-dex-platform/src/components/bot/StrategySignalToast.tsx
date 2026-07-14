import { TrendingDown, TrendingUp, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface StrategySignal {
  id: string
  type: 'buy' | 'sell'
  message: string
  time: string
}

interface StrategySignalToastProps {
  signals: StrategySignal[]
  onDismiss: (id: string) => void
}

export function StrategySignalToastStack({ signals, onDismiss }: StrategySignalToastProps) {
  if (signals.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-24 right-6 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {signals.map((signal) => (
        <div
          key={signal.id}
          className={cn(
            'pointer-events-auto rounded-xl border bg-card shadow-2xl overflow-hidden',
            signal.type === 'buy' ? 'border-success/30' : 'border-error/30',
          )}
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <div
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                signal.type === 'buy' ? 'bg-success/15 text-success' : 'bg-error/15 text-error',
              )}
            >
              {signal.type === 'buy' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {signal.type === 'buy' ? 'Стратегия предлагает купить' : 'Стратегия предлагает продать'}
              </p>
              <p className="mt-0.5 text-xs text-muted">{signal.message}</p>
              <p className="mt-1 text-[10px] font-mono text-muted">{signal.time}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(signal.id)}
              className="shrink-0 text-muted hover:text-foreground transition-colors"
              aria-label="Закрыть"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
