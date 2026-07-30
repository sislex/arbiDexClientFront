import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { BotSessionTradesTable } from '../components/bot/BotSessionTradesTable'
import { ServerBotSimulationPage } from '../simulation/ServerBotSimulationPage'
import { StrategySimulationWorkspace } from '../simulation/StrategySimulationWorkspace'
import { NETWORK_COLORS } from '../simulation/simulationNetworkTypes'
import { mapServerLiveTradeToLogEvent } from '../lib/mapServerBotStepResult'
import { findQuoteIndexByTime } from '../lib/inspectBotStep'
import {
  fmtDurationMs,
  fmtSessionTime,
  fmtSigned,
  sessionModeLabel,
} from '../lib/botFormatters'
import {
  fetchBotQuotes,
  fetchBotSession,
  fetchBotTrades,
  fetchServerBot,
  type ServerBot,
  type ServerBotSession,
  type ServerBotTrade,
  type ServerChartPoint,
  type ServerQuotePoint,
} from '../services/botsApi'
import { useAppPreferences } from '../context/AppPreferencesContext'

function quotesToChartData(quotes: ServerQuotePoint[], chartPoints?: ServerChartPoint[]) {
  if (chartPoints?.length) return chartPoints
  return quotes.map((q) => ({
    t: q.time,
    label: new Date(q.time).toISOString(),
    avg: q.avgObservedQuote,
    trading_buy: q.buyQuote,
    trading_sell: q.sellQuote,
  }))
}

function SessionStatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono text-lg font-semibold text-foreground">{children}</div>
    </div>
  )
}

function CompletedSessionView({
  bot,
  session,
  isDark,
}: {
  bot: ServerBot
  session: ServerBotSession
  isDark: boolean
}) {
  const [quotes, setQuotes] = useState<ServerQuotePoint[]>([])
  const [chartPoints, setChartPoints] = useState<ServerChartPoint[]>([])
  const [networks, setNetworks] = useState<Awaited<ReturnType<typeof fetchBotQuotes>>['networks']>([])
  const [trades, setTrades] = useState<ServerBotTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playIdx, setPlayIdx] = useState(0)
  const [selectedStepTime, setSelectedStepTime] = useState<number | null>(null)

  const sessionTo = session.endedAt || Date.now()

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      fetchBotQuotes(bot.id, { from: session.startedAt, to: sessionTo }),
      fetchBotTrades(bot.id, { from: session.startedAt, to: sessionTo }),
    ])
      .then(([quotesResponse, tradeRows]) => {
        if (!alive) return
        setQuotes(quotesResponse.quotes)
        setChartPoints(quotesResponse.chartPoints ?? [])
        setNetworks(quotesResponse.networks ?? [])
        setTrades(tradeRows)
        setPlayIdx(Math.max(0, quotesResponse.quotes.length - 1))
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить данные сессии')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [bot.id, session.startedAt, sessionTo])

  const chartData = useMemo(() => quotesToChartData(quotes, chartPoints), [quotes, chartPoints])

  const displayNetworks = useMemo(
    () =>
      (networks ?? []).map((network, index) => ({
        id: network.id,
        label: network.label,
        color: NETWORK_COLORS[index % NETWORK_COLORS.length],
      })),
    [networks],
  )

  const tradingNetworkIds = useMemo(
    () => new Set((networks ?? []).filter((n) => n.role === 'trading').map((n) => n.id)),
    [networks],
  )

  const events = useMemo(
    () =>
      trades
        .map((trade) => mapServerLiveTradeToLogEvent(trade, quotes))
        .sort((a, b) => a.dataIdx - b.dataIdx),
    [trades, quotes],
  )

  const handleTradeClick = useCallback(
    (trade: ServerBotTrade) => {
      const idx = findQuoteIndexByTime(quotes, trade.time)
      setPlayIdx(idx)
      setSelectedStepTime(quotes[idx]?.time ?? trade.time)
    },
    [quotes],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted">
        <Loader2 size={18} className="animate-spin" />
        Загрузка данных сессии…
      </div>
    )
  }

  if (error) {
    return <div className="py-12 text-center text-error">{error}</div>
  }

  const pnlColor = session.pnl >= 0 ? 'text-success' : 'text-error'

  return (
    <div className="space-y-4" data-testid="session-page-completed">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SessionStatCard label="Длительность">
          {fmtDurationMs(session.endedAt - session.startedAt)}
        </SessionStatCard>
        <SessionStatCard label="Сделок">
          {session.tradesCount}
          {session.failedCount > 0 && (
            <span className="ml-2 text-xs font-normal text-error">неудачных: {session.failedCount}</span>
          )}
        </SessionStatCard>
        <SessionStatCard label="Результат">
          <span className={pnlColor}>
            {fmtSigned(session.pnl)}{' '}
            <span className="text-sm font-normal">
              ({session.pnlPct >= 0 ? '+' : ''}{session.pnlPct.toFixed(2)}%)
            </span>
          </span>
        </SessionStatCard>
        <SessionStatCard label="Баланс на старте">
          {session.startBalance.toFixed(2)} {bot.quoteAsset}
        </SessionStatCard>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Котировки за сессию</span>
          <Badge variant="purple">{quotes.length} шагов</Badge>
        </div>
        <div className="h-[min(520px,58vh)] min-h-[360px]">
          {quotes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted">Нет котировок за окно сессии</div>
          ) : (
            <StrategySimulationWorkspace
              className="h-full min-h-0"
              isDark={isDark}
              chartData={chartData}
              chartFullData={chartData}
              events={events}
              eventLogRevision={Math.trunc(session.startedAt / 1000)}
              stepResult={null}
              networks={displayNetworks.length > 0 ? displayNetworks : [{ id: 'trading', label: `${bot.baseAsset}/${bot.quoteAsset}`, color: NETWORK_COLORS[0] }]}
              tradingNetworkIds={tradingNetworkIds.size > 0 ? tradingNetworkIds : new Set(['trading'])}
              playIdx={playIdx}
              onPlayIdxChange={setPlayIdx}
              isPlaying={false}
              onPlayingChange={() => {}}
              speed={1}
              onSpeedChange={() => {}}
              loading={false}
              token1Label={bot.baseAsset}
              token2Label={bot.quoteAsset}
              header={{
                pairLabel: `${bot.baseAsset}/${bot.quoteAsset}`,
                networksLabel: `${bot.baseAsset}/${bot.quoteAsset}`,
                profitCurrency: bot.quoteAsset,
              }}
              showPlayer
              selectedStepTime={selectedStepTime}
              onChartStepInspect={(time) => {
                setSelectedStepTime(time)
                setPlayIdx(findQuoteIndexByTime(quotes, time))
              }}
            />
          )}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Сделки сессии ({trades.length})</span>
        </div>
        <BotSessionTradesTable
          trades={trades}
          baseAsset={bot.baseAsset}
          quoteAsset={bot.quoteAsset}
          onRowClick={handleTradeClick}
        />
      </Card>
    </div>
  )
}

export function BotSessionPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>()
  const navigate = useNavigate()
  const { theme } = useAppPreferences()
  const isDark = theme === 'dark'

  const [bot, setBot] = useState<ServerBot | null>(null)
  const [session, setSession] = useState<ServerBotSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !sessionId) return
    let alive = true
    setLoading(true)
    Promise.all([fetchServerBot(id), fetchBotSession(id, sessionId)])
      .then(([loadedBot, loadedSession]) => {
        if (!alive) return
        setBot(loadedBot)
        setSession(loadedSession)
        setError(null)
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Сессия не найдена')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, sessionId])

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center gap-2 text-muted">
        <Loader2 size={18} className="animate-spin" />
        Загрузка сессии…
      </div>
    )
  }

  if (error || !bot || !session || !id) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4">
        <p className="text-error">{error ?? 'Сессия не найдена'}</p>
        <Button onClick={() => navigate(`/bots/${id}?tab=sessions`)}>К сессиям</Button>
      </div>
    )
  }

  const subtitle = `${fmtSessionTime(session.startedAt)} — ${
    session.active ? 'идёт' : fmtSessionTime(session.endedAt)
  } · ${sessionModeLabel(session.mode)}`

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden" data-testid="bot-session-page">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card/50 px-4 py-3">
        <Button variant="ghost" size="sm" className="px-2" onClick={() => navigate(`/bots/${id}?tab=sessions`)} data-testid="session-back">
          <ArrowLeft size={14} />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-foreground">Сессия · {bot.name}</h1>
          <p className="truncate text-xs text-muted">{subtitle}</p>
        </div>
        <div className="flex-1" />
        <Link to={`/bots/${id}?tab=trade`}>
          <Button variant="outline" size="sm">К торговле</Button>
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {session.active ? (
          <ServerBotSimulationPage
            bot={bot}
            isDark={isDark}
            className="h-full min-h-0 w-full flex-1 overflow-hidden"
            header={{
              pairLabel: `${bot.baseAsset}/${bot.quoteAsset}`,
              networksLabel: `${bot.baseAsset}/${bot.quoteAsset}`,
              id: bot.id,
              status: bot.status,
              profitCurrency: bot.quoteAsset,
              badge: <Badge variant="success">Активная сессия</Badge>,
            }}
            onBotUpdated={setBot}
          />
        ) : (
          <div className="h-full overflow-y-auto px-4 py-4">
            <CompletedSessionView bot={bot} session={session} isDark={isDark} />
          </div>
        )}
      </div>
    </div>
  )
}
