import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { BotPeriodState } from '../../hooks/useBotPeriod'
import type { EditableExcludedRange } from '../../lib/excludedRanges'

interface BotExcludedRangesPickerProps {
  period: BotPeriodState
  ranges: EditableExcludedRange[]
  selectedRangeId: string | null
  modeLabel?: string
  onSelectRange: (id: string | null) => void
  onAddMode: () => void
  onEditMode: () => void
  onDeleteSelected: () => void
  onUpdateRangeBounds: (id: string, next: { start: number; end: number }) => void
}

export function BotExcludedRangesPicker({
  period,
  ranges,
  selectedRangeId,
  modeLabel,
  onSelectRange,
  onAddMode,
  onEditMode,
  onDeleteSelected,
  onUpdateRangeBounds,
}: BotExcludedRangesPickerProps) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = ranges.find((r) => r.id === selectedRangeId) ?? null

  useLayoutEffect(() => {
    if (!open || !toggleRef.current) {
      setMenuPos(null)
      return
    }
    const updatePosition = () => {
      const rect = toggleRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPos({ top: rect.bottom + 4, left: rect.left })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const baseButtonClass =
    'rounded px-2 py-1 text-[11px] font-medium border border-border text-muted hover:text-foreground hover:border-foreground/30 transition-colors'

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        className={cn(baseButtonClass, 'inline-flex items-center gap-1')}
        onClick={() => setOpen((v) => !v)}
      >
        Не включать диапазон ({ranges.length})
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {modeLabel ? <span className="ml-2 text-[10px] text-warning">{modeLabel}</span> : null}
      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] min-w-[26rem] max-w-[34rem] rounded-lg border border-border bg-card p-2 shadow-xl"
              style={{ top: menuPos.top, left: menuPos.left }}
              data-testid="excluded-ranges-menu"
            >
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  className={cn(baseButtonClass, 'inline-flex items-center gap-1')}
                  onClick={onAddMode}
                  title="A"
                >
                  <Plus size={12} />
                  Добавить
                </button>
                <button
                  type="button"
                  className={cn(baseButtonClass, 'inline-flex items-center gap-1')}
                  onClick={onEditMode}
                  disabled={!selected}
                  title="E"
                >
                  <Pencil size={12} />
                  Изменить
                </button>
                <button
                  type="button"
                  className={cn(baseButtonClass, 'inline-flex items-center gap-1')}
                  onClick={onDeleteSelected}
                  disabled={!selected}
                  title="Delete"
                >
                  <Trash2 size={12} />
                  Удалить
                </button>
                <span className="ml-auto text-[10px] text-muted">A / E / Delete / Esc</span>
              </div>

              {ranges.length === 0 ? (
                <div className="rounded border border-dashed border-border px-2 py-2 text-[11px] text-muted">
                  Нет исключенных диапазонов
                </div>
              ) : (
                <div className="max-h-72 space-y-1 overflow-auto pr-1">
                  {ranges.map((range, idx) => {
                    const active = range.id === selectedRangeId
                    return (
                      <button
                        key={range.id}
                        type="button"
                        className={cn(
                          'w-full rounded border px-2 py-1.5 text-left transition-colors',
                          active ? 'border-accent-purple bg-accent-purple/10' : 'border-border hover:bg-white/5',
                        )}
                        onClick={() => onSelectRange(range.id)}
                      >
                        <div className="mb-1 text-[10px] text-muted">#{idx + 1}</div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <label className="inline-flex items-center gap-1 text-muted">
                            <span>c</span>
                            <input
                              type="datetime-local"
                              className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground"
                              value={period.dateStr(range.start)}
                              onChange={(e) => {
                                const parsed = period.parseDate(e.target.value)
                                if (parsed == null) return
                                onUpdateRangeBounds(range.id, { start: parsed, end: range.end })
                              }}
                            />
                          </label>
                          <label className="inline-flex items-center gap-1 text-muted">
                            <span>по</span>
                            <input
                              type="datetime-local"
                              className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground"
                              value={period.dateStr(range.end)}
                              onChange={(e) => {
                                const parsed = period.parseDate(e.target.value)
                                if (parsed == null) return
                                onUpdateRangeBounds(range.id, { start: range.start, end: parsed })
                              }}
                            />
                          </label>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
