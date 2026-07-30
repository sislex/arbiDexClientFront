import { AlertOctagon, Loader2, Pause, Play, Square, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '../ui/Button'
import type { ServerBotStatus } from '../../services/botsApi'
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
  serverBotStatus?: ServerBotStatus | null
  statusLoading?: boolean
  onStart?: () => void
  onPause?: () => void
  onStop?: () => void
  tradeHandlers?: BotTradeHandlers | null
}

export function BotTradingButtons({
  fundMode,
  tradeMode,
  serverBotStatus = null,
  statusLoading = false,
  onStart,
  onPause,
  onStop,
  tradeHandlers,
}: BotTradingButtonsProps) {
  const isDemo = fundMode === 'demo'
  const isManual = tradeMode === 'manual'
  const hasRuntimeControls = tradeMode === 'auto' && serverBotStatus != null

  const buyLabel = isDemo ? 'Demo Buy' : 'Buy'
  const sellLabel = isDemo ? 'Demo Sell' : 'Sell'
  const pending = tradeHandlers?.tradePending ?? false
  const canBuy = Boolean(tradeHandlers?.canBuy)
  const canSell = Boolean(tradeHandlers?.canSell)

  return (
    <>
      {hasRuntimeControls && (
        <>
          <Button
            size="sm"
            variant="primary"
            disabled={statusLoading || serverBotStatus === 'running'}
            onClick={onStart}
            data-testid="bot-start"
          >
            <Play size={14} />
            Старт
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={statusLoading || serverBotStatus !== 'running'}
            onClick={onPause}
            data-testid="bot-pause"
          >
            <Pause size={14} />
            Пауза
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={statusLoading || serverBotStatus === 'stopped'}
            onClick={onStop}
            data-testid="bot-stop"
          >
            <Square size={14} />
            Стоп
          </Button>
        </>
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

      {!isDemo && isManual && (
        <Button variant="danger" size="sm">
          <AlertOctagon size={14} /> Emergency Stop
        </Button>
      )}
    </>
  )
}
