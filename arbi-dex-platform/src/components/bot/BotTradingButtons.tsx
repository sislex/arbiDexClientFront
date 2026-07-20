import { AlertOctagon, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '../ui/Button'
import type { FundMode, TradeMode } from './TradingModeToggles'

export interface BotTradeHandlers {
  onBuy: () => void
  onSell: () => void
  tradePending: boolean
  tradeError: string | null
  canBuy: boolean
  canSell: boolean
}

interface BotTradingButtonsProps {
  fundMode: FundMode
  tradeMode: TradeMode
  autoRunning?: boolean
  onAutoToggle?: () => void
  tradeHandlers?: BotTradeHandlers | null
}

export function BotTradingButtons({
  fundMode,
  tradeMode,
  autoRunning,
  onAutoToggle,
  tradeHandlers,
}: BotTradingButtonsProps) {
  const isDemo = fundMode === 'demo'
  const isAuto = tradeMode === 'auto'
  const buyLabel = isDemo ? 'Demo Buy' : 'Buy'
  const sellLabel = isDemo ? 'Demo Sell' : 'Sell'
  const pending = tradeHandlers?.tradePending ?? false
  const canBuy = Boolean(tradeHandlers?.canBuy)
  const canSell = Boolean(tradeHandlers?.canSell)

  return (
    <>
      {isAuto && !isDemo && onAutoToggle && (
        <Button
          variant={autoRunning ? 'danger' : 'secondary'}
          size="sm"
          onClick={onAutoToggle}
        >
          {autoRunning ? 'Пауза авто' : 'Запустить авто'}
        </Button>
      )}
      <Button
        variant="secondary"
        size="sm"
        disabled={!canBuy || pending}
        onClick={tradeHandlers?.onBuy}
        title={
          !tradeHandlers
            ? 'Торговля доступна на странице серверного бота'
            : !canBuy
              ? 'Покупка недоступна (нет баланса, позиция открыта или бот в idle)'
              : undefined
        }
        data-testid="trade-buy"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : null}
        <TrendingUp size={14} /> {buyLabel}
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={!canSell || pending}
        onClick={tradeHandlers?.onSell}
        title={
          !tradeHandlers
            ? 'Торговля доступна на странице серверного бота'
            : !canSell
              ? 'Продажа недоступна (нет открытой позиции или бот в idle)'
              : undefined
        }
        data-testid="trade-sell"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : null}
        <TrendingDown size={14} /> {sellLabel}
      </Button>
      {!isDemo && !isAuto && (
        <Button variant="danger" size="sm">
          <AlertOctagon size={14} /> Emergency Stop
        </Button>
      )}
    </>
  )
}
