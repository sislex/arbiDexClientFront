import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Edit2, Settings } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  FundModeToggle,
  TradeModeToggle,
  type FundMode,
  type TradeMode,
} from './TradingModeToggles'

interface BotSettingsDropdownProps {
  fundMode: FundMode
  tradeMode: TradeMode
  onFundModeChange: (mode: FundMode) => void
  onTradeModeChange: (mode: TradeMode) => void
  historyHref?: string
  editHref?: string
}

export function BotSettingsDropdown({
  fundMode,
  tradeMode,
  onFundModeChange,
  onTradeModeChange,
  historyHref,
  editHref,
}: BotSettingsDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        title="Настройки"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Settings size={14} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-3 shadow-xl">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Счёт</p>
          <FundModeToggle mode={fundMode} onChange={onFundModeChange} />
          <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted">Режим</p>
          <TradeModeToggle mode={tradeMode} onChange={onTradeModeChange} />
          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
            {historyHref && (
              <Link
                to={historyHref}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-white/5 hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <Clock size={14} />
                Исторические данные
              </Link>
            )}
            {editHref && (
              <Link
                to={editHref}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-white/5 hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <Edit2 size={14} />
                Редактировать бота
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
