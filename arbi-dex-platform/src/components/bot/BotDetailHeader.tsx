import { Link } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/Badge'
import { BotTradingButtons, type BotTradeHandlers } from './BotTradingButtons'
import { BotSettingsDropdown } from './BotSettingsDropdown'
import type { FundMode, TradeMode } from './TradingModeToggles'

export interface BotDetailHeaderProps {
  displayName: string
  displayPair: string
  displayId: string
  displayStatus: 'active' | 'paused' | 'stopped'
  displayStrategy: string
  tradingExchange: string
  displayBalance: number
  balanceLabel: string
  quoteAsset: string
  useServerSimulation?: boolean
  fundMode: FundMode
  tradeMode: TradeMode
  autoRunning: boolean
  editableBotId?: string
  historyHref?: string
  onFundModeChange: (mode: FundMode) => void
  onTradeModeChange: (mode: TradeMode) => void
  onAutoToggle: () => void
  tradeHandlers?: BotTradeHandlers | null
}

export function BotDetailHeader({
  displayName,
  displayPair,
  displayId,
  displayStatus,
  displayStrategy,
  tradingExchange,
  displayBalance,
  balanceLabel,
  quoteAsset,
  useServerSimulation,
  fundMode,
  tradeMode,
  autoRunning,
  editableBotId,
  historyHref,
  onFundModeChange,
  onTradeModeChange,
  onAutoToggle,
  tradeHandlers,
}: BotDetailHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card/50 px-4 py-2">
      <Link to="/bots" title="К ботам">
        <Button variant="ghost" size="sm" className="px-2">
          <ArrowLeft size={14} />
        </Button>
      </Link>

      <h1 className="min-w-0 truncate text-base font-bold text-foreground">{displayName}</h1>

      <div className="group relative shrink-0">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-white/20 hover:text-foreground"
          aria-label="Информация о боте"
        >
          <Info size={14} />
        </button>
        <div
          className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-72 rounded-xl border border-border bg-card p-3 text-xs shadow-xl group-hover:block group-focus-within:block"
          role="tooltip"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="font-semibold text-foreground">{displayPair}</span>
            <StatusBadge status={displayStatus} />
          </div>
          <dl className="space-y-1.5 text-muted">
            <div className="flex justify-between gap-3">
              <dt>ID</dt>
              <dd className="font-mono text-foreground text-right break-all">{displayId}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Биржа</dt>
              <dd className="text-foreground">{tradingExchange}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Стратегия</dt>
              <dd className="text-foreground text-right">{displayStrategy}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{balanceLabel}</dt>
              <dd className="font-mono text-foreground">
                {displayBalance.toFixed(2)} {quoteAsset}
              </dd>
            </div>
            {useServerSimulation && (
              <div className="pt-1 text-accent-purple">Server backtest · ≤1000 steps</div>
            )}
          </dl>
        </div>
      </div>

      <div className="flex-1" />

      <BotSettingsDropdown
        fundMode={fundMode}
        tradeMode={tradeMode}
        onFundModeChange={onFundModeChange}
        onTradeModeChange={onTradeModeChange}
        historyHref={historyHref}
        editHref={editableBotId ? `/bots/${editableBotId}/edit` : undefined}
      />

      <BotTradingButtons
        fundMode={fundMode}
        tradeMode={tradeMode}
        autoRunning={autoRunning}
        onAutoToggle={onAutoToggle}
        tradeHandlers={tradeHandlers}
      />
      {tradeHandlers?.tradeError && (
        <span className="max-w-[12rem] truncate text-[10px] text-error" title={tradeHandlers.tradeError}>
          {tradeHandlers.tradeError}
        </span>
      )}
    </div>
  )
}
