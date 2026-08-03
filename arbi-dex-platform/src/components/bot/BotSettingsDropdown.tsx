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
  /** Допустимое проскальзывание, % (серверный бот). */
  slippagePct?: number
  onSlippagePctChange?: (value: number) => void | Promise<void>
  slippageSaving?: boolean
}

export function BotSettingsDropdown({
  fundMode,
  tradeMode,
  onFundModeChange,
  onTradeModeChange,
  historyHref,
  editHref,
  slippagePct,
  onSlippagePctChange,
  slippageSaving = false,
}: BotSettingsDropdownProps) {
  const [open, setOpen] = useState(false)
  const [slippageDraft, setSlippageDraft] = useState(String(slippagePct ?? 0.5))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSlippageDraft(String(slippagePct ?? 0.5))
  }, [slippagePct])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const slippageDirty =
    onSlippagePctChange != null &&
    Number(slippageDraft) !== (slippagePct ?? 0.5) &&
    Number.isFinite(Number(slippageDraft))

  const saveSlippage = () => {
    if (!onSlippagePctChange || !slippageDirty) return
    const next = Number(slippageDraft)
    if (next < 0 || next > 50) return
    void onSlippagePctChange(next)
  }

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
          {onSlippagePctChange != null && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Исполнение
              </p>
              <label className="mb-1 block text-xs text-muted">Допустимое проскальзывание, %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.1}
                  value={slippageDraft}
                  disabled={slippageSaving}
                  onChange={(e) => setSlippageDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveSlippage()
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground"
                  data-testid="bot-settings-slippage"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!slippageDirty || slippageSaving}
                  onClick={saveSlippage}
                >
                  {slippageSaving ? '…' : 'OK'}
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-muted">
                Если к моменту сделки котировка ушла в невыгодную сторону сильнее — транзакция
                отклоняется
              </p>
            </div>
          )}
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
