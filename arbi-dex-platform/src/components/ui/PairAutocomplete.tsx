import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface PairOption {
  pair: string
  price: number
  change: number
  botsCount?: number
}

interface PairAutocompleteProps {
  pairs: PairOption[]
  value: string
  onChange: (pair: string) => void
  className?: string
  placeholder?: string
}

export function PairAutocomplete({
  pairs,
  value,
  onChange,
  className,
  placeholder = 'Поиск пары...',
}: PairAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = pairs.find((p) => p.pair === value)

  const filtered = pairs.filter((p) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      p.pair.toLowerCase().includes(q) ||
      p.pair.replace('/', '').toLowerCase().includes(q.replace('/', ''))
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

  const selectPair = (pair: string) => {
    onChange(pair)
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
      selectPair(filtered[highlightIndex].pair)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
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
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={open ? placeholder : value}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder:text-muted focus:outline-none"
        />
        {selected && !open && (
          <span className={cn('text-xs font-medium shrink-0', selected.change >= 0 ? 'text-success' : 'text-error')}>
            {selected.change >= 0 ? '+' : ''}{selected.change.toFixed(2)}%
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
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Пара не найдена</p>
            ) : (
              filtered.map((item, index) => {
                const isSelected = item.pair === value
                const isHighlighted = index === highlightIndex
                const [base, quote] = item.pair.split('/')

                return (
                  <button
                    key={item.pair}
                    type="button"
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectPair(item.pair)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors',
                      isHighlighted ? 'bg-accent-purple/10' : 'hover:bg-white/[0.03]',
                      isSelected && 'bg-accent-purple/5',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-xs font-bold text-accent-purple">
                        {base.slice(0, 3)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {base}
                          <span className="text-muted">/{quote}</span>
                        </p>
                        {item.botsCount !== undefined && (
                          <p className="text-xs text-muted">{item.botsCount} active bots</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">
                        ${item.price >= 1000 ? item.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : item.price.toFixed(item.price < 1 ? 4 : 2)}
                      </p>
                      <p className={cn('text-xs font-medium', item.change >= 0 ? 'text-success' : 'text-error')}>
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                      </p>
                    </div>
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
