import { cn } from '../../lib/utils'

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-surface rounded-xl border border-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            active === tab.id
              ? 'bg-accent-purple text-white shadow-sm'
              : 'text-muted hover:text-white hover:bg-white/5',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function PairTabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border',
            active === tab.id
              ? 'bg-accent-purple/15 text-accent-purple border-accent-purple/30'
              : 'bg-card text-muted border-border hover:text-white hover:border-white/10',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/5 text-xs">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
