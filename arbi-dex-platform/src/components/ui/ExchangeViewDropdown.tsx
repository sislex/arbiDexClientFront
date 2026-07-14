import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ExchangeViewDropdownProps {
  exchanges: string[]
  tradingExchange?: string | null
  monitoring?: boolean
  className?: string
  compact?: boolean
}

export function ExchangeViewDropdown({
  exchanges,
  tradingExchange,
  monitoring,
  className,
  compact,
}: ExchangeViewDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const label = monitoring
    ? `${exchanges.length} · мон.`
    : exchanges.length === 1
      ? exchanges[0]
      : `${exchanges.length} бирж`

  return (
    <div ref={ref} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between gap-1 w-full min-w-0 px-2 py-1.5 bg-surface border border-border rounded-lg text-slate-300',
          compact ? 'text-xs' : 'text-sm px-3 py-2 rounded-xl',
          'hover:border-white/15 transition-colors cursor-default',
          open && 'border-accent-purple/40',
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={compact ? 12 : 14}
          className={cn('text-muted shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-full rounded-xl bg-card border border-border shadow-xl py-1">
          {exchanges.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">Нет бирж</p>
          ) : (
            exchanges.map((ex) => (
              <div
                key={ex}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-300"
              >
                <span className={cn(!monitoring && ex === tradingExchange && 'text-white font-medium')}>{ex}</span>
                {!monitoring && ex === tradingExchange && (
                  <span className="text-[10px] font-medium text-accent-purple uppercase shrink-0">Trade</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
