import { useState } from 'react'
import type { BotEvent } from '../../data/botDemoData'
import { cn } from '../../lib/utils'

export function EventLogPanel({
  events,
  totalCount,
}: {
  events: BotEvent[]
  totalCount: number
}) {
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL'>('all')

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
          Журнал событий
          <span className="text-muted font-normal ml-2">{events.length} / {totalCount}</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="px-2 py-1 text-[10px] rounded-md border border-border text-muted hover:text-white hover:border-white/20"
          >
            Очистить лог
          </button>
          {(['all', 'BUY', 'SELL'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-2 py-1 text-[10px] rounded-md border transition-colors',
                filter === f
                  ? 'border-warning/40 bg-warning/10 text-warning'
                  : 'border-border text-muted hover:text-white',
              )}
            >
              {f === 'all' ? 'Filter' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 max-h-64">
        {filtered.map((ev) => (
          <div key={ev.id} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted shrink-0 w-14">{ev.time}</span>
            <span
              className={cn(
                'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold',
                ev.type === 'BUY' && 'bg-success/15 text-success',
                ev.type === 'SELL' && 'bg-error/15 text-error',
                ev.type === 'INFO' && 'bg-accent-cyan/15 text-accent-cyan',
                ev.type === 'ERROR' && 'bg-warning/15 text-warning',
              )}
            >
              {ev.type}
            </span>
            <span className="text-white/80 truncate">{ev.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
