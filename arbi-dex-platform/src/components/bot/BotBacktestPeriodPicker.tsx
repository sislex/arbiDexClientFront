import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, MousePointerClick } from 'lucide-react'
import type { BotPeriodState, ChartPeriodPickMode } from '../../hooks/useBotPeriod'
import { cn } from '../../lib/utils'

interface BotBacktestPeriodPickerProps {
  period: BotPeriodState
  idPrefix?: string
  className?: string
  chartPickMode?: ChartPeriodPickMode
  onChartPickModeChange?: (mode: ChartPeriodPickMode) => void
  chartDataAvailable?: boolean
}

type PresetId = 'hour' | 'day' | 'week' | 'month' | 'all'

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'hour', label: 'Час' },
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Вся история' },
]

export function BotBacktestPeriodPicker({
  period,
  idPrefix = 'bt',
  className,
  chartPickMode = 'idle',
  onChartPickModeChange,
  chartDataAvailable = true,
}: BotBacktestPeriodPickerProps) {
  const { range, from, to, setFrom, setTo, setPreset, dateStr, parseDate, HOUR, DAY, WEEK, MONTH } = period
  const min = range ? dateStr(range.historyFrom) : undefined
  const max = range ? dateStr(range.historyTo) : undefined

  const [presetOpen, setPresetOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const presetRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!presetOpen || !toggleRef.current) {
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
  }, [presetOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (presetRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setPresetOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const applyPreset = (id: PresetId) => {
    switch (id) {
      case 'hour':
        setPreset(HOUR)
        break
      case 'day':
        setPreset(DAY)
        break
      case 'week':
        setPreset(WEEK)
        break
      case 'month':
        setPreset(MONTH)
        break
      case 'all':
        setPreset('all')
        break
    }
    setPresetOpen(false)
  }

  const toggleChartPick = () => {
    if (!onChartPickModeChange) return
    onChartPickModeChange(chartPickMode === 'idle' ? 'from' : 'idle')
  }

  const pickButtonLabel =
    chartPickMode === 'idle'
      ? 'Выбрать период на графике'
      : chartPickMode === 'from'
        ? 'Кликните: начало'
        : 'Кликните: конец'

  const presetBtn =
    'rounded px-2 py-1 text-[11px] font-medium border border-border text-muted hover:text-foreground hover:border-foreground/30 transition-colors'

  const presetMenu =
    presetOpen && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[9rem] rounded-lg border border-border bg-card py-1 shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left }}
            data-testid={`${idPrefix}-preset-menu`}
          >
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[11px] text-foreground hover:bg-white/5"
                onClick={() => applyPreset(preset.id)}
                data-testid={`${idPrefix}-preset-${preset.id}`}
              >
                {preset.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div ref={presetRef} className="relative" data-testid={`${idPrefix}-presets`}>
        <button
          ref={toggleRef}
          type="button"
          className={cn(presetBtn, 'inline-flex items-center gap-1')}
          onClick={() => setPresetOpen((v) => !v)}
          aria-expanded={presetOpen}
          data-testid={`${idPrefix}-preset-toggle`}
        >
          Период
          <ChevronDown size={12} className={cn('transition-transform', presetOpen && 'rotate-180')} />
        </button>
      </div>
      {presetMenu}

      <label className="flex items-center gap-1.5 text-[11px] text-muted">
        <span>Начало</span>
        <input
          type="datetime-local"
          className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground"
          value={dateStr(from)}
          onChange={(e) => setFrom(parseDate(e.target.value))}
          min={min}
          max={dateStr(to) || max}
          data-testid={`${idPrefix}-from`}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[11px] text-muted">
        <span>Конец</span>
        <input
          type="datetime-local"
          className="rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground"
          value={dateStr(to)}
          onChange={(e) => setTo(parseDate(e.target.value))}
          min={dateStr(from) || min}
          max={max}
          data-testid={`${idPrefix}-to`}
        />
      </label>

      {onChartPickModeChange && (
        <button
          type="button"
          className={cn(
            presetBtn,
            'inline-flex items-center gap-1.5',
            chartPickMode !== 'idle' && 'border-accent-purple text-accent-purple bg-accent-purple/10',
          )}
          onClick={toggleChartPick}
          disabled={!chartDataAvailable}
          title={pickButtonLabel}
          data-testid={`${idPrefix}-pick-period`}
        >
          <MousePointerClick size={12} />
          {pickButtonLabel}
        </button>
      )}
    </div>
  )
}

/** Apply a chart click when picking backtest period bounds (first click → from, second → to). */
export function applyChartPeriodPick(
  period: BotPeriodState,
  time: number,
  pickMode: ChartPeriodPickMode,
  setPickMode: (mode: ChartPeriodPickMode) => void,
): void {
  if (pickMode === 'from') {
    period.setFrom(time)
    if (period.to != null && time > period.to) period.setTo(time)
    setPickMode('to')
    return
  }
  if (pickMode === 'to') {
    if (period.from != null && time < period.from) {
      period.setTo(period.from)
      period.setFrom(time)
    } else {
      period.setTo(time)
    }
    setPickMode('idle')
  }
}
