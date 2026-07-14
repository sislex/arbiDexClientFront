import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock, EyeOff } from 'lucide-react'
import { PageContent } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { StatusBadge, Badge } from '../components/ui/Badge'
import {
  HistoricalRangeFormModal,
  type HistoricalRangeFormValues,
} from '../components/bot/HistoricalRangeFormModal'
import { StrategySimulationPage } from '../simulation/StrategySimulationPage'
import { FIXTURE_CHART_STRATEGY } from '../fixtures/fixtureStrategy'
import { getBotById, getStrategies, getStrategyById } from '../data/mockData'
import { useAppPreferences } from '../context/AppPreferencesContext'
import { FIXTURE_SIMULATION_PAYLOAD } from '../lib/simulationPayload'
import {
  formatHistoricalRangeLabel,
  parseHistoricalPreset,
  resolveHistoricalRange,
  type HistoricalRangePreset,
} from '../lib/historicalRange'

export function BotHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { theme } = useAppPreferences()
  const bot = getBotById(id ?? '')

  const rangeApplied = searchParams.get('applied') === '1'
  const rangePreset = parseHistoricalPreset(searchParams.get('range'))
  const strategies = getStrategies()
  const strategyId = searchParams.get('strategy') ?? bot?.strategyId ?? strategies[0]?.id ?? ''

  const [rangeModalOpen, setRangeModalOpen] = useState(() => searchParams.get('applied') !== '1')

  const historicalRange = useMemo(
    () => resolveHistoricalRange(rangePreset, searchParams.get('from'), searchParams.get('to')),
    [rangePreset, searchParams],
  )

  const rangeLabel = formatHistoricalRangeLabel(historicalRange)
  const selectedStrategy = getStrategyById(strategyId)

  const syncParams = useCallback(
    (patch: {
      range?: HistoricalRangePreset
      strategy?: string
      from?: string
      to?: string
      applied?: boolean
    }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (patch.range !== undefined) next.set('range', patch.range)
          if (patch.strategy !== undefined) next.set('strategy', patch.strategy)
          if (patch.from !== undefined) next.set('from', patch.from)
          if (patch.to !== undefined) next.set('to', patch.to)
          if (patch.applied) next.set('applied', '1')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const handleApplyRange = (values: HistoricalRangeFormValues) => {
    syncParams({
      range: values.preset,
      strategy: values.strategyId,
      from: values.from,
      to: values.to,
      applied: true,
    })
    setRangeModalOpen(false)
  }

  const handleModalClose = () => {
    if (!rangeApplied) {
      navigate('/bots')
      return
    }
    setRangeModalOpen(false)
  }

  useEffect(() => {
    if (searchParams.get('applied') !== '1') {
      setRangeModalOpen(true)
    }
  }, [id, searchParams])

  if (!bot) {
    return (
      <PageContent className="py-12 text-center">
        <p className="text-muted mb-4">Бот не найден</p>
        <Button onClick={() => navigate('/bots')}>К списку ботов</Button>
      </PageContent>
    )
  }

  const strategyOptions = strategies.map((s) => ({ value: s.id, label: s.name }))

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 w-full max-w-full min-w-0 flex-col overflow-hidden">
      <HistoricalRangeFormModal
        open={rangeModalOpen}
        onClose={handleModalClose}
        onApply={handleApplyRange}
        initialPreset={rangeApplied ? rangePreset : '30d'}
        initialFrom={searchParams.get('from') ?? undefined}
        initialTo={searchParams.get('to') ?? undefined}
        initialStrategyId={strategyId}
        strategyOptions={strategyOptions}
        botName={bot.name}
      />

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
                <span className="flex items-center gap-1.5 text-foreground">
                  <Clock size={12} />
                  Исторические данные
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {rangeApplied && (
              <Button variant="outline" size="sm" onClick={() => setRangeModalOpen(true)}>
                Изменить период
              </Button>
            )}
            <Link to={`/bots/${bot.id}?mode=demo&trade=auto`}>
              <Button variant="outline" size="sm">
                К торговле
              </Button>
            </Link>
          </div>
        </div>

        {rangeApplied && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="cyan">
              <Clock size={12} className="inline mr-1" />
              Исторический график
            </Badge>
            <Badge variant="default">
              <EyeOff size={12} className="inline mr-1" />
              Только просмотр
            </Badge>
            <Badge variant="purple">{selectedStrategy?.name ?? FIXTURE_CHART_STRATEGY.name}</Badge>
            <span className="text-xs text-muted">{rangeLabel}</span>
          </div>
        )}
      </div>

      <div className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${!rangeApplied ? 'opacity-40 pointer-events-none' : ''}`}>
        {!rangeApplied ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted text-sm">Выберите период в форме выше</p>
          </div>
        ) : (
          <StrategySimulationPage
            payload={FIXTURE_SIMULATION_PAYLOAD}
            isDark={theme === 'dark'}
            className="min-h-0 h-full w-full min-w-0 flex-1 overflow-hidden"
            strategy={FIXTURE_CHART_STRATEGY}
            header={{
              pairLabel: bot.pair,
              id: bot.id,
              status: bot.status === 'active' ? 'Running' : bot.status === 'paused' ? 'Paused' : 'Stopped',
              rules: FIXTURE_CHART_STRATEGY.rules,
              profitCurrency: bot.profitCurrency ?? 'USDT',
              badge: <Badge variant="cyan">Исторические данные · {rangeLabel}</Badge>,
            }}
          />
        )}
      </div>
    </div>
  )
}
