import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Group, Panel, Separator } from 'react-resizable-panels'
import {
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
} from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Tabs } from '../components/ui/Tabs'
import { StatusBadge, Badge } from '../components/ui/Badge'
import { TradingPairSetSelect } from '../components/ui/TradingPairSetSelect'
import { MultiExchangeChart, ExchangePricePanel } from '../components/charts/MultiExchangeChart'
import { Modal, ModalFooter } from '../components/ui/Modal'
import {
  AddPairsGridForm,
  selectionFromTradingPairRecord,
} from '../components/forms/AddPairsGridForm'
import type { ChartPairSelection } from '../types/chart'
import {
  getBots,
  getPairExchangeConfig,
  getTradingPairById,
  getTradingPairs,
  isMonitoringPair,
  PAIR_MARKET_DATA,
  type TradingPair,
} from '../data/mockData'
import { useExchangeChartData } from '../hooks/useExchangeChartData'
import { cn, formatCurrency } from '../lib/utils'

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
  const botId = searchParams.get('bot')
  const modeParam = searchParams.get('mode') as TradingMode | null
  const setIdParam = searchParams.get('set')

  const botFromUrl = botId ? getBots().find((b) => b.id === botId) : null
  const tradingMode: TradingMode = modeParam === 'demo' ? 'demo' : 'live'

  const initialPairSet = resolvePairSetFromUrl(setIdParam, botFromUrl?.pair)

  const [logTab, setLogTab] = useState('trades')
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

  const market = PAIR_MARKET_DATA[selectedPair] ?? { price: 1000, change: 0 }
  const activeBot = botFromUrl ?? getBots().find((b) => b.pair === selectedPair && b.status === 'active')
  const activeSelection =
    chartSelections.find((s) => s.id === selectedPairSetId) ??
    chartSelections.find((s) => s.pair === selectedPair) ??
    chartSelections[0]
  const baseCoin = selectedPair.split('/')[0]
  const exchangeConfig = getPairExchangeConfig(selectedPair, selectedPairSetId)
  const chartQuery = useExchangeChartData(activeSelection)

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

  if (!selectedPairSet) {
    return (
      <>
        <PageHeader title={pageTitle} subtitle="Нет торговых пар" />
        <PageContent>
          <Card className="p-8 text-center">
            <p className="text-muted mb-4">Добавьте торговую пару в разделе Trading Pairs</p>
            <Link to="/pairs">
              <Button variant="outline">Перейти к парам</Button>
            </Link>
          </Card>
        </PageContent>
      </>
    )
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
          <div className="flex items-center gap-3">
            {botFromUrl && (
              <Link to="/bots">
                <Button variant="ghost" size="sm">
                  <ArrowLeft size={14} /> К ботам
                </Button>
              </Link>
            )}
            {isDemo && <Badge variant="cyan">Demo</Badge>}
            {!isDemo && canTrade && botFromUrl && <Badge variant="success">Auto Trading</Badge>}
            {!canTrade && (
              <Badge variant="cyan">Только мониторинг</Badge>
            )}
            <div className="flex gap-2">
              {!isDemo && canTrade && (
                <>
                  <Button variant="secondary" size="sm"><TrendingUp size={14} /> Buy</Button>
                  <Button variant="danger" size="sm"><TrendingDown size={14} /> Sell</Button>
                  <Button variant="danger" size="sm"><AlertOctagon size={14} /> Emergency Stop</Button>
                </>
              )}
            </div>
          </div>
        }
      />
      <PageContent className="h-[calc(100vh-120px)]">
        <Group orientation="horizontal" className="h-full gap-2">
          <Panel defaultSize={70} minSize={40}>
            <div className="h-full flex flex-col gap-2">
              <Card className="flex-1 p-3 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <TradingPairSetSelect
                      value={selectedPairSetId}
                      onChange={handlePairSetChange}
                      className="w-72 max-w-full"
                    />
                    <span className="text-success font-bold whitespace-nowrap">
                      {formatCurrency(market.price)}
                    </span>
                    <span className={cn('text-xs font-medium whitespace-nowrap', market.change >= 0 ? 'text-success' : 'text-error')}>
                      {market.change >= 0 ? '+' : ''}{market.change.toFixed(2)}%
                    </span>
                    <span className="text-[10px] text-muted font-mono whitespace-nowrap">
                      ID: {selectedPairSet.id}
                    </span>
                    {exchangeConfig && !exchangeConfig.tradingExchange && exchangeConfig.purpose === 'monitoring' ? (
                      <span className="text-xs text-accent-cyan">
                        Мониторинг · {exchangeConfig.allExchanges.length} бирж
                      </span>
                    ) : exchangeConfig?.tradingExchange ? (
                      <span className="text-xs text-muted">
                        Trade: <span className="text-accent-purple">{exchangeConfig.tradingExchange}</span>
                        {exchangeConfig.referenceExchanges.length > 0 && (
                          <> · Avg: {exchangeConfig.referenceExchanges.join(', ')}</>
                        )}
                      </span>
                    ) : null}
                  </div>
                  <StatusBadge status={activeBot?.status ?? 'active'} />
                </div>
                <div className="flex-1 min-h-0">
                  <MultiExchangeChart
                    selections={chartSelections}
                    primaryPair={selectedPair}
                    className="h-full"
                    onConfigure={openPairsForm}
                    chartData={chartQuery.data}
                    chartLoading={chartQuery.loading}
                    networks={chartQuery.networks}
                    chartError={chartQuery.error}
                    onChartReload={chartQuery.reload}
                  />
                </div>
              </Card>

              <Card className="h-48 p-0 overflow-hidden shrink-0">
                <div className="px-4 pt-3">
                  <Tabs
                    tabs={[
                      { id: 'trades', label: 'Trade Log' },
                      { id: 'bot', label: 'Bot Log' },
                      { id: 'errors', label: 'Errors' },
                    ]}
                    active={logTab}
                    onChange={setLogTab}
                  />
                </div>
                <div className="px-4 py-2 overflow-y-auto h-32 text-xs font-mono space-y-1">
                  {logTab === 'trades' && (
                    <>
                      {canTrade ? (
                        <>
                          <p className="text-accent-cyan">[11:14:02] BUY 0.015 {baseCoin} @ {formatCurrency(market.price)} ({exchangeConfig?.tradingExchange})</p>
                          <p className="text-accent-purple">[11:09:45] SELL 0.012 {baseCoin} · +$12.40</p>
                        </>
                      ) : (
                        <p className="text-accent-cyan">[11:14:02] Price update · {selectedPairSet.name} · monitoring only</p>
                      )}
                      <p className="text-muted">[11:09:44] Signal: price vs avg spread 0.08%</p>
                      {canTrade && (
                        <p className="text-accent-cyan">[10:58:12] BUY 0.018 {baseCoin} @ avg cross</p>
                      )}
                    </>
                  )}
                  {logTab === 'bot' && (
                    <>
                      <p className="text-muted">[11:14:01] Avg ({exchangeConfig?.priceMethod}) crossed trading price</p>
                      {canTrade && (
                        <p className="text-muted">[11:14:02] Order placed on {exchangeConfig?.tradingExchange}</p>
                      )}
                      <p className="text-muted">[11:09:44] Take profit triggered at 0.06%</p>
                    </>
                  )}
                  {logTab === 'errors' && (
                    <p className="text-muted">No errors in the last 24 hours</p>
                  )}
                </div>
              </Card>
            </div>
          </Panel>

          <Separator className="w-1 bg-border rounded-full hover:bg-accent-purple/50 transition-colors" />

          <Panel defaultSize={30} minSize={20}>
            <div className="h-full flex flex-col gap-2 overflow-y-auto">
              <Card>
                <CardHeader><CardTitle>Exchange Prices</CardTitle></CardHeader>
                <ExchangePricePanel
                  pair={selectedPair}
                  selection={activeSelection}
                  chartData={chartQuery.data}
                  networks={chartQuery.networks}
                />
              </Card>

              {canTrade ? (
                <>
                  <Card>
                    <CardHeader><CardTitle>Open Position</CardTitle></CardHeader>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">Side</span>
                        <span className="text-accent-cyan font-medium">LONG</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">Entry</span>
                        <span className="text-white">{formatCurrency(market.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">Size</span>
                        <span className="text-white">0.015 {baseCoin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">Unrealized PnL</span>
                        <span className="text-success font-medium">+$4.50</span>
                      </div>
                      {isDemo && (
                        <p className="text-xs text-accent-cyan pt-1 border-t border-border">Demo — виртуальный баланс</p>
                      )}
                    </div>
                  </Card>

                  <Card className="flex-1">
                    <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-surface">
                        <div>
                          <p className="text-white">TP Limit</p>
                          <p className="text-xs text-muted">Sell @ {formatCurrency(market.price * 1.006)}</p>
                        </div>
                        <span className="text-success text-xs">Pending</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-surface">
                        <div>
                          <p className="text-white">SL Stop</p>
                          <p className="text-xs text-muted">Sell @ {formatCurrency(market.price * 0.995)}</p>
                        </div>
                        <span className="text-error text-xs">Pending</span>
                      </div>
                    </div>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardHeader><CardTitle>Режим наблюдения</CardTitle></CardHeader>
                  <p className="text-sm text-muted">
                    Набор «{selectedPairSet.name}» предназначен только для мониторинга. Торговые операции недоступны.
                  </p>
                  <p className="text-[10px] text-muted font-mono mt-3">ID: {selectedPairSet.id}</p>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>Events</CardTitle></CardHeader>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2">
                    <span className="text-muted shrink-0">11:14</span>
                    <span className="text-slate-300">
                      {canTrade
                        ? `Position opened on ${exchangeConfig?.tradingExchange}`
                        : `Monitoring update · ${selectedPairSet.name}`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted shrink-0">11:09</span>
                    <span className="text-slate-300">Take profit hit +$12.40</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted shrink-0">10:58</span>
                    <span className="text-slate-300">Avg price signal triggered</span>
                  </div>
                </div>
              </Card>
            </div>
          </Panel>
        </Group>
      </PageContent>

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
