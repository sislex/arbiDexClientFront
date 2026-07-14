import { AlertOctagon, Bot, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '../ui/Button'
import type { FundMode, TradeMode } from './TradingModeToggles'

interface TradingActionBarProps {
  fundMode: FundMode
  tradeMode: TradeMode
  exchange: string
  autoRunning?: boolean
  onAutoToggle?: () => void
}

export function TradingActionBar({
  fundMode,
  tradeMode,
  exchange,
  autoRunning,
  onAutoToggle,
}: TradingActionBarProps) {
  const isDemo = fundMode === 'demo'
  const isAuto = tradeMode === 'auto'
  const buyLabel = isDemo ? 'Demo Buy' : 'Buy'
  const sellLabel = isDemo ? 'Demo Sell' : 'Sell'

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-surface/40 px-4 py-3">
      <div className="min-w-0">
        {isAuto ? (
          <p className="text-sm text-muted">
            <Bot size={14} className="inline mr-1.5 -mt-0.5" />
            Авто-торговля на {exchange}
            {isDemo ? ' · demo' : ' · реальные деньги'}
            {!isDemo && (autoRunning ? ' · бот управляет позицией' : ' · на паузе')}
            <span className="block text-xs mt-0.5 text-muted/80">
              Вы можете вручную подтвердить Buy / Sell
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted">
            Ручная торговля · {exchange} · {isDemo ? 'виртуальный баланс' : 'реальные деньги'}
            <span className="block text-xs mt-0.5 text-muted/80">
              Следите за подсказками стратегии выше
            </span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {isAuto && !isDemo && onAutoToggle && (
          <Button
            variant={autoRunning ? 'danger' : 'secondary'}
            size="sm"
            onClick={onAutoToggle}
          >
            {autoRunning ? 'Пауза авто' : 'Запустить авто'}
          </Button>
        )}
        <Button variant="secondary" size="sm">
          <TrendingUp size={14} /> {buyLabel}
        </Button>
        <Button variant="danger" size="sm">
          <TrendingDown size={14} /> {sellLabel}
        </Button>
        {!isDemo && !isAuto && (
          <Button variant="danger" size="sm">
            <AlertOctagon size={14} /> Emergency Stop
          </Button>
        )}
      </div>
    </div>
  )
}
