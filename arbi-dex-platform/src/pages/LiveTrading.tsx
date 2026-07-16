import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
} from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { TradingPairSetSelect } from '../components/ui/TradingPairSetSelect'
import { Modal, ModalFooter } from '../components/ui/Modal'
import {
  AddPairsGridForm,
  selectionFromTradingPairRecord,
} from '../components/forms/AddPairsGridForm'
import type { ChartPairSelection } from '../types/chart'
import {
  getBots,
  getTradingPairById,
  getTradingPairs,
  isMonitoringPair,
  type TradingPair,
} from '../data/mockData'
import { buildLiveTradingStrategy } from '../lib/buildBotSimulationStrategy'
import { LiveStrategySimulationPage } from '../simulation/LiveStrategySimulationPage'
import { useAppPreferences } from '../context/AppPreferencesContext'

type TradingMode = 'live' | 'demo'

function resolvePairSetFromUrl(
  setId: string | null,
  botPair: string | undefined,
): TradingPair | undefined {
  const pairs = getTradingPairs()
  if (setId) {
    const found = pairs.find((p) => p.id === setId)
    if (found) return found
  }
  if (botPair) {
    return (
      pairs.find((p) => p.pair === botPair && p.purpose !== 'monitoring') ??
      pairs.find((p) => p.pair === botPair) ??
      pairs[0]
    )
  }
  return pairs[0]
}

export function LiveTradingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { theme } = useAppPreferences()
  const botId = searchParams.get('bot')
  const modeParam = searchParams.get('mode') as TradingMode | null
  const setIdParam = searchParams.get('set')

  const botFromUrl = botId ? getBots().find((b) => b.id === botId) : null
  const tradingMode: TradingMode = modeParam === 'demo' ? 'demo' : 'live'

  const initialPairSet = resolvePairSetFromUrl(setIdParam, botFromUrl?.pair)

  const [selectedPairSetId, setSelectedPairSetId] = useState(initialPairSet?.id ?? '')
  const [pairsFormOpen, setPairsFormOpen] = useState(false)
  const [chartSelections, setChartSelections] = useState<ChartPairSelection[]>(() =>
    initialPairSet ? [selectionFromTradingPairRecord(initialPairSet)] : [],
  )
  const [draftSelections, setDraftSelections] = useState<ChartPairSelection[]>(chartSelections)

  const selectedPairSet = useMemo(
    () => getTradingPairById(selectedPairSetId),
    [selectedPairSetId],
  )
  const selectedPair = selectedPairSet?.pair ?? 'BTC/USDT'
  const canTrade = Boolean(selectedPairSet && !isMonitoringPair(selectedPairSet))

  const syncUrl = useCallback(
    (pairSet: TradingPair) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('set', pairSet.id)
          next.set('purpose', pairSet.purpose === 'monitoring' ? 'monitoring' : 'trading')
          if (!next.has('mode')) next.set('mode', tradingMode)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams, tradingMode],
  )

  useEffect(() => {
    if (botFromUrl && !setIdParam) {
      const match = resolvePairSetFromUrl(null, botFromUrl.pair)
      if (match && match.id !== selectedPairSetId) {
        setSelectedPairSetId(match.id)
        const sel = selectionFromTradingPairRecord(match)
        setChartSelections([sel])
        setDraftSelections([sel])
        syncUrl(match)
      }
    }
  }, [botFromUrl, setIdParam, selectedPairSetId, syncUrl])

  useEffect(() => {
    if (selectedPairSet) {
      syncUrl(selectedPairSet)
    }
  }, [selectedPairSet, syncUrl])

  const activeBot = botFromUrl ?? getBots().find((b) => b.pair === selectedPair && b.status === 'active')
  const activeSelection =
    chartSelections.find((s) => s.id === selectedPairSetId) ??
    chartSelections.find((s) => s.pair === selectedPair) ??
    chartSelections[0]

  const simulationStrategy = useMemo(
    () => (selectedPairSet ? buildLiveTradingStrategy(selectedPairSet, activeBot ?? null) : null),
    [selectedPairSet, activeBot],
  )

  const handlePairSetChange = (id: string) => {
    const pairSet = getTradingPairById(id)
    if (!pairSet) return
    setSelectedPairSetId(id)
    const sel = selectionFromTradingPairRecord(pairSet)
    setChartSelections([sel])
    setDraftSelections([sel])
    syncUrl(pairSet)
  }

  const openPairsForm = () => {
    setDraftSelections(chartSelections.map((s) => ({ ...s })))
    setPairsFormOpen(true)
  }

  const applyPairsForm = () => {
    setChartSelections(draftSelections)
    if (draftSelections.length > 0) {
      const primary = draftSelections.find((s) => s.pair === selectedPair) ?? draftSelections[0]
      const match = getTradingPairById(primary.id)
      if (match) {
        setSelectedPairSetId(match.id)
        syncUrl(match)
      }
    }
    setPairsFormOpen(false)
  }

  const isDemo = tradingMode === 'demo'
  const pageTitle = isDemo ? 'Demo Trading' : 'Live Trading'

  if (!selectedPairSet || !simulationStrategy) {
    return (
      <>
        <PageHeader title={pageTitle} subtitle="Нет торговых пар" />
        <PageContent>
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted mb-4">Добавьте торговую пару в разделе Trading Pairs</p>
            <Link to="/pairs">
              <Button variant="outline">Перейти к парам</Button>
            </Link>
          </div>
        </PageContent>
      </>
    )
  }

  const botStatus =
    activeBot?.status === 'active'
      ? 'Running'
      : activeBot?.status === 'paused'
        ? 'Paused'
        : 'Live'

  const simulationHeader = {
    pairLabel: selectedPairSet.name,
    networksLabel: activeSelection
      ? activeSelection.selectedExchanges.join(' · ')
      : selectedPair,
    id: activeBot?.id ?? selectedPairSet.id,
    status: botStatus,
    rules: simulationStrategy.rules,
    profitCurrency: activeBot?.profitCurrency ?? 'USDT',
    badge: (
      <>
        {isDemo && <Badge variant="cyan">Demo</Badge>}
        {!isDemo && canTrade && activeBot && <Badge variant="success">Auto Trading</Badge>}
        {!canTrade && <Badge variant="cyan">Только мониторинг</Badge>}
      </>
    ),
  }

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle={
          activeBot
            ? `${activeBot.name} · ${selectedPairSet.name} · ${activeBot.strategy}`
            : `${selectedPairSet.name} · ${selectedPair}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {botFromUrl && (
              <Link to="/bots">
                <Button variant="ghost" size="sm">
                  <ArrowLeft size={14} /> К ботам
                </Button>
              </Link>
            )}
            <TradingPairSetSelect
              value={selectedPairSetId}
              onChange={handlePairSetChange}
              className="w-56 max-w-full"
            />
            <Button variant="outline" size="sm" onClick={openPairsForm}>
              Пары на графике
            </Button>
            {!isDemo && canTrade && (
              <>
                <Button variant="secondary" size="sm"><TrendingUp size={14} /> Buy</Button>
                <Button variant="danger" size="sm"><TrendingDown size={14} /> Sell</Button>
                <Button variant="danger" size="sm"><AlertOctagon size={14} /> Emergency Stop</Button>
              </>
            )}
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ height: 'calc(100dvh - 7.5rem)' }}>
        <LiveStrategySimulationPage
          key={`${selectedPairSet.id}-${activeBot?.id ?? 'live'}`}
          strategy={simulationStrategy}
          chartSelection={activeSelection ?? null}
          isDark={theme === 'dark'}
          showPlayer={false}
          className="min-h-0 h-full w-full min-w-0 flex-1 overflow-hidden"
          header={simulationHeader}
        />
      </div>

      <Modal
        open={pairsFormOpen}
        onClose={() => setPairsFormOpen(false)}
        title="Пары на графике"
        size="xl"
        footer={
          <ModalFooter
            onCancel={() => setPairsFormOpen(false)}
            onConfirm={applyPairsForm}
            confirmLabel="Применить"
          />
        }
      >
        <AddPairsGridForm selections={draftSelections} onChange={setDraftSelections} />
      </Modal>
    </>
  )
}
