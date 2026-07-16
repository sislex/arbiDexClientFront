import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bot, Clock } from 'lucide-react'
import { PageContent } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { StatusBadge, Badge } from '../components/ui/Badge'
import { TradingActionBar } from '../components/bot/TradingActionBar'
import { StrategySignalToastStack } from '../components/bot/StrategySignalToast'
import {
  FundModeToggle,
  TradeModeToggle,
  type FundMode,
  type TradeMode,
} from '../components/bot/TradingModeToggles'
import { LiveStrategySimulationPage } from '../simulation/LiveStrategySimulationPage'
import { buildBotSimulationStrategy, getBotChartSelection } from '../lib/buildBotSimulationStrategy'
import { getBotById, getPairExchangeConfig, PAIR_MARKET_DATA } from '../data/mockData'
import { useAppPreferences } from '../context/AppPreferencesContext'
import { useStrategySignalsFromSimulation } from '../hooks/useStrategySignals'
import { cn, formatCurrency } from '../lib/utils'

function parseFundMode(value: string | null): FundMode {
  return value === 'online' ? 'online' : 'demo'
}

function parseTradeMode(value: string | null): TradeMode {
  return value === 'manual' ? 'manual' : 'auto'
}

export function BotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { theme } = useAppPreferences()
  const bot = getBotById(id ?? '')

  const fundMode = parseFundMode(searchParams.get('mode'))
  const tradeMode = parseTradeMode(searchParams.get('trade'))

  const [autoRunning, setAutoRunning] = useState(fundMode === 'online' && tradeMode === 'auto')

  const isDemo = fundMode === 'demo'
  const isAuto = tradeMode === 'auto'
  const isManual = tradeMode === 'manual'

  const { signals, dismissSignal, onStepResultChange } = useStrategySignalsFromSimulation(isManual)

  const exchangeConfig = getPairExchangeConfig(bot?.pair ?? 'BTC/USDT', bot?.pairSetId)
  const tradingExchange = exchangeConfig?.tradingExchange ?? 'Binance'
  const market = PAIR_MARKET_DATA[bot?.pair ?? 'BTC/USDT'] ?? { price: 67420, change: 0 }

  const syncParams = useCallback(
    (nextFund: FundMode, nextTrade: TradeMode) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('mode', nextFund)
          next.set('trade', nextTrade)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setFundMode = (mode: FundMode) => {
    if (mode === 'online' && tradeMode === 'auto') setAutoRunning(true)
    syncParams(mode, tradeMode)
  }

  const setTradeMode = (mode: TradeMode) => {
    if (mode === 'auto' && fundMode === 'online') setAutoRunning(true)
    if (mode === 'manual') setAutoRunning(false)
    syncParams(fundMode, mode)
  }

  useEffect(() => {
    if (!searchParams.has('mode') || !searchParams.has('trade')) {
      syncParams(fundMode, tradeMode)
    }
  }, [searchParams, fundMode, tradeMode, syncParams])

  if (!bot) {
    return (
      <PageContent className="py-12 text-center">
        <p className="text-muted mb-4">Бот не найден</p>
        <Button onClick={() => navigate('/bots')}>К списку ботов</Button>
      </PageContent>
    )
  }

  const balanceLabel = isDemo ? 'Demo баланс' : 'Баланс'
  const botStatus =
    bot.status === 'active' ? 'Running' : bot.status === 'paused' ? 'Paused' : 'Stopped'
  const simulationStrategy = buildBotSimulationStrategy(bot)
  const chartSelection = getBotChartSelection(bot)

  const simulationHeader = {
    pairLabel: bot.pair,
    networksLabel: `${tradingExchange} ${bot.pair}`,
    id: bot.id,
    status: botStatus,
    rules: simulationStrategy.rules,
    profitCurrency: bot.profitCurrency ?? 'USDT',
    badge: isDemo ? (
      <Badge variant="cyan">Demo · {bot.strategy}</Badge>
    ) : (
      <Badge variant="success">Live · реальные деньги</Badge>
    ),
  }

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] min-h-0 w-full max-w-full min-w-0 flex-col overflow-hidden">
      <StrategySignalToastStack signals={signals} onDismiss={dismissSignal} />

      <div className="shrink-0 border-b border-border bg-card/50 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/bots">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={14} /> К ботам
              </Button>
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">{bot.name}</h1>
                <span className="text-sm text-muted">{bot.pair}</span>
                <StatusBadge status={bot.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted">
                <span>ID: <span className="font-mono text-foreground">{bot.id}</span></span>
                <span>{tradingExchange}</span>
                <span>Стратегия: <span className="text-foreground">{bot.strategy}</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <FundModeToggle mode={fundMode} onChange={setFundMode} />
            <TradeModeToggle mode={tradeMode} onChange={setTradeMode} />
            <Link to={`/bots/${bot.id}/history`}>
              <Button variant="outline" size="sm" title="Исторические данные">
                <Clock size={14} />
              </Button>
            </Link>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{bot.balance.toFixed(2)} USDT</p>
              <p className="text-xs text-muted">{balanceLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isDemo && <Badge variant="cyan">Demo · live данные</Badge>}
          {!isDemo && <Badge variant="success">Live · реальные деньги</Badge>}
          {isAuto ? (
            <Badge variant="purple">
              <Bot size={12} className="inline mr-1" />
              Авто-торговля{autoRunning && !isDemo ? ' · активна' : ''}
            </Badge>
          ) : (
            <Badge variant="cyan">Ручная торговля</Badge>
          )}
          {isManual && (
            <Badge variant="warning">Подсказки стратегии включены</Badge>
          )}
          <span className={cn('text-sm font-semibold', market.change >= 0 ? 'text-success' : 'text-error')}>
            {formatCurrency(market.price)}
            <span className="ml-2 text-xs font-medium">
              {market.change >= 0 ? '+' : ''}{market.change.toFixed(2)}%
            </span>
          </span>
        </div>
      </div>

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <LiveStrategySimulationPage
          strategy={simulationStrategy}
          chartSelection={chartSelection}
          isDark={theme === 'dark'}
          className="min-h-0 h-full w-full min-w-0 flex-1 overflow-hidden"
          onStepResultChange={onStepResultChange}
          header={simulationHeader}
        />
        <TradingActionBar
          fundMode={fundMode}
          tradeMode={tradeMode}
          exchange={tradingExchange}
          autoRunning={autoRunning}
          onAutoToggle={() => setAutoRunning((v) => !v)}
        />
      </div>
    </div>
  )
}
