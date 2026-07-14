import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { getTradingPairs, isMonitoringPair, type TradingPair } from '../../data/mockData'
import { cn } from '../../lib/utils'

interface TradingPairSetSelectProps {
  value: string
  onChange: (pairSetId: string) => void
  className?: string
}

export function TradingPairSetSelect({ value, onChange, className }: TradingPairSetSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pairs = getTradingPairs()
  const selected = pairs.find((p) => p.id === value)

  const filtered = pairs.filter((p) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      p.pair.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectPairSet = (pairSet: TradingPair) => {
    onChange(pairSet.id)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[highlightIndex]) {
      e.preventDefault()
      selectPairSet(filtered[highlightIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const displayLabel = selected ? `${selected.name} · ${selected.pair}` : 'Выберите набор...'

  return (
    <div ref={containerRef} className={cn('relative min-w-0', className)}>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 bg-surface border rounded-xl transition-colors',
          open ? 'border-accent-purple/50 ring-1 ring-accent-purple/20' : 'border-border hover:border-white/10',
        )}
      >
        <Search size={16} className="text-muted shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : displayLabel}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={open ? 'Поиск по имени, паре или ID...' : displayLabel}
          className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-muted focus:outline-none truncate"
        />
        {selected && !open && (
          <span
            className={cn(
              'text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full',
              isMonitoringPair(selected)
                ? 'bg-accent-cyan/15 text-accent-cyan'
                : 'bg-accent-purple/15 text-accent-purple',
            )}
          >
            {isMonitoringPair(selected) ? 'Монит.' : 'Торг.'}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            if (!open) inputRef.current?.focus()
          }}
          className="text-muted hover:text-white transition-colors shrink-0"
        >
          <ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden min-w-[280px]">
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Набор не найден</p>
            ) : (
              filtered.map((item, index) => {
                const isSelected = item.id === value
                const isHighlighted = index === highlightIndex
                const monitoring = isMonitoringPair(item)

                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectPairSet(item)}
                    className={cn(
                      'w-full flex items-start justify-between gap-3 px-4 py-2.5 text-left transition-colors',
                      isHighlighted ? 'bg-accent-purple/10' : 'hover:bg-white/[0.03]',
                      isSelected && 'bg-accent-purple/5',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-muted">{item.pair}</p>
                      <p className="text-[10px] text-muted font-mono truncate mt-0.5">ID: {item.id}</p>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full mt-0.5',
                        monitoring
                          ? 'bg-accent-cyan/15 text-accent-cyan'
                          : 'bg-accent-purple/15 text-accent-purple',
                      )}
                    >
                      {monitoring ? 'Мониторинг' : 'Торговля'}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
