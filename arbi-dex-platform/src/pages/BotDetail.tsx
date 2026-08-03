import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageContent } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { BotDetailHeader } from '../components/bot/BotDetailHeader'
import { BotSessionsTab } from '../components/bot/BotSessionsTab'
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
import { fetchServerBot, isServerBotId, updateServerBot, type ServerBot, type ServerBotUpdatePayload } from '../services/botsApi'
import { STRATEGY_CONFIG_UPDATED_EVENT, type StrategyConfigUpdatedDetail } from '../lib/pushStrategyRulesToServer'
import { useAppPreferences } from '../context/AppPreferencesContext'
import { useAuth } from '../context/AuthContext'
import { useStrategySignalsFromSimulation } from '../hooks/useStrategySignals'
import { Tabs } from '../components/ui/Tabs'

type BotDetailTab = 'trade' | 'sessions'

function parseFundMode(value: string | null): FundMode {
  return value === 'online' ? 'online' : 'demo'
}

function parseTradeMode(value: string | null): TradeMode {
  return value === 'manual' ? 'manual' : 'auto'
}

function parseBotTab(value: string | null): BotDetailTab {
  return value === 'sessions' ? 'sessions' : 'trade'
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
  const botTab = parseBotTab(searchParams.get('tab'))
  const isDemo = fundMode === 'demo'

  const [serverBot, setServerBot] = useState<ServerBot | null>(null)
  const [serverLoadError, setServerLoadError] = useState<string | null>(null)
  const [serverLoading, setServerLoading] = useState(false)
  const [slippageSaving, setSlippageSaving] = useState(false)

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

  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [tradeHandlers, setTradeHandlers] = useState<BotTradeHandlers | null>(null)

  const isManual = tradeMode === 'manual'

  const { signals, dismissSignal, onStepResultChange } = useStrategySignalsFromSimulation(isManual)

  const bot = localBot
  const displayName = bot?.name ?? serverBot?.name ?? 'Bot'
  const displayPair = bot?.pair ?? (serverBot ? `${serverBot.baseAsset}/${serverBot.quoteAsset}` : '—')
  const displayBalance = serverBot?.balance ?? bot?.balance ?? 0
  const displayStatus =
    tradeMode === 'auto' && serverBot
      ? serverBot.status === 'running'
        ? 'active'
        : serverBot.status === 'paused'
          ? 'paused'
          : 'stopped'
      : bot?.status ?? 'stopped'
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
    syncParams(mode, tradeMode)
  }

  const setTradeMode = (mode: TradeMode) => {
    syncParams(fundMode, mode)
  }

  const setBotTab = useCallback(
    (tab: BotDetailTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (tab === 'trade') next.delete('tab')
          else next.set('tab', tab)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    if (!searchParams.has('mode') || !searchParams.has('trade')) {
      syncParams(fundMode, tradeMode)
    }
  }, [searchParams, fundMode, tradeMode, syncParams])

  const handleBotRefresh = useCallback(() => {
    if (!resolvedServerBotId) return
    fetchServerBot(resolvedServerBotId)
      .then(setServerBot)
      .catch(() => {})
  }, [resolvedServerBotId])

  useEffect(() => {
    const onStrategyUpdated = (event: Event) => {
      const detail = (event as CustomEvent<StrategyConfigUpdatedDetail>).detail
      if (!resolvedServerBotId || !serverBot) return
      const linked =
        detail?.configIds?.includes(serverBot.strategyConfigId) ||
        detail?.stoppedBotIds?.includes(resolvedServerBotId)
      if (!linked) return
      setSessionsRefreshKey((k) => k + 1)
      handleBotRefresh()
    }
    window.addEventListener(STRATEGY_CONFIG_UPDATED_EVENT, onStrategyUpdated)
    return () => window.removeEventListener(STRATEGY_CONFIG_UPDATED_EVENT, onStrategyUpdated)
  }, [handleBotRefresh, resolvedServerBotId, serverBot])

  const patchBotStatus = useCallback(
    async (payload: ServerBotUpdatePayload) => {
      if (!resolvedServerBotId) return
      setStatusLoading(true)
      setStatusError(null)
      try {
        const updated = await updateServerBot(resolvedServerBotId, payload)
        setServerBot(updated)
        if (payload.status === 'running' || payload.status === 'stopped') {
          setSessionsRefreshKey((k) => k + 1)
        }
      } catch (e) {
        setStatusError(e instanceof Error ? e.message : 'Не удалось обновить статус бота')
      } finally {
        setStatusLoading(false)
      }
    },
    [resolvedServerBotId],
  )

  const handleStart = useCallback(() => {
    if (!serverBot) return
    const payload: ServerBotUpdatePayload = { status: 'running' }
    if (serverBot.status !== 'paused') {
      payload.mode = fundMode === 'online' ? 'real-live' : 'demo-live'
    }
    void patchBotStatus(payload)
  }, [serverBot, fundMode, patchBotStatus])

  const handlePause = useCallback(() => {
    void patchBotStatus({ status: 'paused' })
  }, [patchBotStatus])

  const handleStop = useCallback(() => {
    void patchBotStatus({ status: 'stopped' })
  }, [patchBotStatus])

  const handleSlippagePctChange = useCallback(
    async (value: number) => {
      if (!resolvedServerBotId) return
      setSlippageSaving(true)
      setStatusError(null)
      try {
        const updated = await updateServerBot(resolvedServerBotId, { slippagePct: value })
        setServerBot(updated)
      } catch (e) {
        setStatusError(e instanceof Error ? e.message : 'Не удалось сохранить проскальзывание')
      } finally {
        setSlippageSaving(false)
      }
    },
    [resolvedServerBotId],
  )

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
        serverBotStatus={tradeMode === 'auto' && resolvedServerBotId ? (serverBot?.status ?? null) : null}
        statusLoading={statusLoading}
        onStart={handleStart}
        onPause={handlePause}
        onStop={handleStop}
        editableBotId={editableBotId}
        historyHref={id ? `/bots/${id}/history` : undefined}
        onFundModeChange={setFundMode}
        onTradeModeChange={setTradeMode}
        tradeHandlers={useServerSimulation && botTab === 'trade' ? tradeHandlers : null}
        slippagePct={serverBot?.slippagePct ?? 0.5}
        onSlippagePctChange={resolvedServerBotId ? handleSlippagePctChange : undefined}
        slippageSaving={slippageSaving}
      />

      {statusError && (
        <div className="shrink-0 border-b border-error/30 bg-error/10 px-4 py-1 text-xs text-error">
          {statusError}
        </div>
      )}

      {resolvedServerBotId && (
        <div className="shrink-0 border-b border-border px-4 py-2">
          <Tabs
            tabs={[
              { id: 'trade', label: 'Торговля' },
              { id: 'sessions', label: 'Сессии' },
            ]}
            active={botTab}
            onChange={(tabId) => setBotTab(tabId as BotDetailTab)}
          />
        </div>
      )}

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {botTab === 'sessions' && resolvedServerBotId ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <BotSessionsTab botId={resolvedServerBotId} refreshKey={sessionsRefreshKey} />
          </div>
        ) : (
          <>
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
            onBotUpdated={setServerBot}
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
          </>
        )}
      </div>
    </div>
  )
}
