import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageContent } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { BotDetailHeader } from '../components/bot/BotDetailHeader'
import type { BotTradeHandlers } from '../components/bot/BotTradingButtons'
import { StrategySignalToastStack } from '../components/bot/StrategySignalToast'
import {
  type FundMode,
  type TradeMode,
} from '../components/bot/TradingModeToggles'
import { LiveStrategySimulationPage } from '../simulation/LiveStrategySimulationPage'
import { ServerBotSimulationPage } from '../simulation/ServerBotSimulationPage'
import { buildBotSimulationStrategy, getBotChartSelection } from '../lib/buildBotSimulationStrategy'
import { getBotById, getPairExchangeConfig } from '../data/mockData'
import { fetchServerBot, isServerBotId, type ServerBot } from '../services/botsApi'
import { useAppPreferences } from '../context/AppPreferencesContext'
import { useAuth } from '../context/AuthContext'
import { useStrategySignalsFromSimulation } from '../hooks/useStrategySignals'

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
  const { isAuthenticated } = useAuth()
  const localBot = getBotById(id ?? '')
  const urlServerBotId = id && isServerBotId(id) ? id : undefined
  const linkedServerBotId = localBot?.serverBotId
  const resolvedServerBotId = linkedServerBotId ?? urlServerBotId

  const fundMode = parseFundMode(searchParams.get('mode'))
  const tradeMode = parseTradeMode(searchParams.get('trade'))
  const isDemo = fundMode === 'demo'

  const [serverBot, setServerBot] = useState<ServerBot | null>(null)
  const [serverLoadError, setServerLoadError] = useState<string | null>(null)
  const [serverLoading, setServerLoading] = useState(false)

  useEffect(() => {
    if (!resolvedServerBotId) {
      setServerBot(null)
      setServerLoadError(null)
      return
    }
    let cancelled = false
    setServerLoading(true)
    setServerLoadError(null)
    fetchServerBot(resolvedServerBotId)
      .then((loaded) => {
        if (!cancelled) setServerBot(loaded)
      })
      .catch((e) => {
        if (!cancelled) {
          setServerBot(null)
          setServerLoadError(e instanceof Error ? e.message : 'Не удалось загрузить бота с сервера')
        }
      })
      .finally(() => {
        if (!cancelled) setServerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [resolvedServerBotId])

  const [autoRunning, setAutoRunning] = useState(fundMode === 'online' && tradeMode === 'auto')
  const [tradeHandlers, setTradeHandlers] = useState<BotTradeHandlers | null>(null)

  const isManual = tradeMode === 'manual'

  const { signals, dismissSignal, onStepResultChange } = useStrategySignalsFromSimulation(isManual)

  const bot = localBot
  const displayName = bot?.name ?? serverBot?.name ?? 'Bot'
  const displayPair = bot?.pair ?? (serverBot ? `${serverBot.baseAsset}/${serverBot.quoteAsset}` : '—')
  const displayBalance = serverBot?.balance ?? bot?.balance ?? 0
  const displayStatus = bot?.status ?? (serverBot?.status === 'running' ? 'active' : serverBot?.status === 'paused' ? 'paused' : 'stopped')
  const displayId = bot?.id ?? serverBot?.id ?? id ?? '—'
  const displayStrategy = bot?.strategy ?? 'Server strategy'
  const quoteAsset = serverBot?.quoteAsset ?? bot?.profitCurrency ?? 'USDT'

  const exchangeConfig = getPairExchangeConfig(bot?.pair ?? displayPair, bot?.pairSetId)
  const tradingExchange = exchangeConfig?.tradingExchange ?? 'DEX'

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

  if (!bot && !resolvedServerBotId && !urlServerBotId) {
    return (
      <PageContent className="py-12 text-center">
        <p className="text-muted mb-4">Бот не найден</p>
        <Button onClick={() => navigate('/bots')}>К списку ботов</Button>
      </PageContent>
    )
  }

  if (resolvedServerBotId && serverLoading && !serverBot && !bot) {
    return (
      <PageContent className="py-12 text-center">
        <p className="text-muted">Загрузка бота с сервера…</p>
      </PageContent>
    )
  }

  if (resolvedServerBotId && serverLoadError && !serverBot && !bot) {
    return (
      <PageContent className="py-12 text-center">
        <p className="text-error mb-4">{serverLoadError}</p>
        <Button onClick={() => navigate('/bots')}>К списку ботов</Button>
      </PageContent>
    )
  }

  if (!bot && !serverBot) {
    return (
      <PageContent className="py-12 text-center">
        <p className="text-muted mb-4">Бот не найден</p>
        <Button onClick={() => navigate('/bots')}>К списку ботов</Button>
      </PageContent>
    )
  }

  const balanceLabel = isDemo ? 'Demo баланс' : 'Баланс'
  const botStatus =
    displayStatus === 'active' ? 'Running' : displayStatus === 'paused' ? 'Paused' : 'Stopped'
  const simulationStrategy = bot ? buildBotSimulationStrategy(bot) : null
  const chartSelection = bot ? getBotChartSelection(bot) : null
  const useServerSimulation = isDemo && Boolean(resolvedServerBotId && serverBot)
  const editableBotId = bot?.id ?? urlServerBotId

  const handleBotRefresh = useCallback(() => {
    if (!resolvedServerBotId) return
    fetchServerBot(resolvedServerBotId)
      .then(setServerBot)
      .catch(() => {})
  }, [resolvedServerBotId])

  const simulationHeader = {
    pairLabel: displayPair,
    networksLabel: `${tradingExchange} ${displayPair}`,
    id: displayId,
    status: botStatus,
    rules: simulationStrategy?.rules ?? 0,
    profitCurrency: bot?.profitCurrency ?? serverBot?.quoteAsset ?? 'USDT',
    badge: isDemo ? (
      <Badge variant="cyan">Demo · {displayStrategy}</Badge>
    ) : (
      <Badge variant="success">Live · реальные деньги</Badge>
    ),
  }

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] min-h-0 w-full max-w-full min-w-0 flex-col overflow-hidden">
      <StrategySignalToastStack signals={signals} onDismiss={dismissSignal} />

      <BotDetailHeader
        displayName={displayName}
        displayPair={displayPair}
        displayId={displayId}
        displayStatus={displayStatus}
        displayStrategy={displayStrategy}
        tradingExchange={tradingExchange}
        displayBalance={displayBalance}
        balanceLabel={balanceLabel}
        quoteAsset={quoteAsset}
        useServerSimulation={useServerSimulation}
        fundMode={fundMode}
        tradeMode={tradeMode}
        autoRunning={autoRunning}
        editableBotId={editableBotId}
        historyHref={id ? `/bots/${id}/history` : undefined}
        onFundModeChange={setFundMode}
        onTradeModeChange={setTradeMode}
        onAutoToggle={() => setAutoRunning((v) => !v)}
        tradeHandlers={useServerSimulation ? tradeHandlers : null}
      />

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {isDemo && !useServerSimulation && (
          <div className="shrink-0 border-b border-border bg-card/80 px-6 py-2 text-xs text-muted">
            {!isAuthenticated ? (
              <>
                Для бэктеста войдите через кошелёк.{' '}
                <Link to="/login" className="text-accent-cyan hover:underline">Войти</Link>
              </>
            ) : serverLoading ? (
              'Загрузка бота с сервера…'
            ) : serverLoadError ? (
              <span className="text-error">{serverLoadError}</span>
            ) : localBot && !localBot.serverBotId ? (
              <>
                Бот ещё не синхронизирован с сервером.{' '}
                <Link to={`/bots/${localBot.id}/edit`} className="text-accent-cyan hover:underline">
                  Откройте редактирование и сохраните
                </Link>
                , чтобы создать серверную копию для бэктеста.
              </>
            ) : (
              'Серверный бэктест недоступен для этого бота.'
            )}
          </div>
        )}
        {useServerSimulation && serverBot ? (
          <ServerBotSimulationPage
            bot={serverBot}
            isDark={theme === 'dark'}
            className="min-h-0 h-full w-full min-w-0 flex-1 overflow-hidden"
            onStepResultChange={onStepResultChange}
            header={simulationHeader}
            onBotRefresh={handleBotRefresh}
            onTradeHandlersChange={setTradeHandlers}
          />
        ) : simulationStrategy && chartSelection ? (
          <LiveStrategySimulationPage
            strategy={simulationStrategy}
            chartSelection={chartSelection}
            isDark={theme === 'dark'}
            className="min-h-0 h-full w-full min-w-0 flex-1 overflow-hidden"
            onStepResultChange={onStepResultChange}
            header={simulationHeader}
          />
        ) : (
          <PageContent className="py-8 text-center text-muted">
            {serverLoadError ?? 'Simulation unavailable'}
          </PageContent>
        )}
      </div>
    </div>
  )
}
