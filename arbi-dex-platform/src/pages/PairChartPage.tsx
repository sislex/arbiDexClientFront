import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, LineChart } from 'lucide-react'
import { selectionFromTradingPairRecord } from '../components/forms/AddPairsGridForm'
import { MultiExchangeChart, ExchangePricePanel } from '../components/charts/MultiExchangeChart'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal, ModalFooter } from '../components/ui/Modal'
import { AddPairsGridForm } from '../components/forms/AddPairsGridForm'
import type { ChartPairSelection } from '../types/chart'
import { useExchangeChartData } from '../hooks/useExchangeChartData'
import { getTradingPairById, isMonitoringPair } from '../data/mockData'
import { cn, formatCurrency } from '../lib/utils'

export function PairChartPage() {
  const { id } = useParams<{ id: string }>()
  const pairSet = id ? getTradingPairById(id) : undefined

  const [pairsFormOpen, setPairsFormOpen] = useState(false)
  const [chartSelections, setChartSelections] = useState<ChartPairSelection[]>(() =>
    pairSet ? [selectionFromTradingPairRecord(pairSet)] : [],
  )
  const [draftSelections, setDraftSelections] = useState<ChartPairSelection[]>(chartSelections)

  useEffect(() => {
    if (pairSet) {
      const next = [selectionFromTradingPairRecord(pairSet)]
      setChartSelections(next)
      setDraftSelections(next)
    }
  }, [pairSet?.id])

  const selection = chartSelections[0]
  const chartQuery = useExchangeChartData(selection)
  const latestPoint = chartQuery.data[chartQuery.data.length - 1]
  const livePrice = latestPoint?.avg ?? latestPoint?.[`${chartQuery.networks[0]?.id}_buy`]
  const prevPoint = chartQuery.data[Math.max(0, chartQuery.data.length - 2)]
  const prevPrice = prevPoint?.avg ?? prevPoint?.[`${chartQuery.networks[0]?.id}_buy`]
  const liveChange =
    typeof livePrice === 'number' && typeof prevPrice === 'number' && prevPrice !== 0
      ? ((livePrice - prevPrice) / prevPrice) * 100
      : null

  const openPairsForm = () => {
    setDraftSelections(chartSelections.map((s) => ({ ...s })))
    setPairsFormOpen(true)
  }

  const applyPairsForm = () => {
    setChartSelections(draftSelections.slice(0, 1))
    setPairsFormOpen(false)
  }

  const exchangeLabel = useMemo(() => {
    if (!pairSet) return ''
    return `${pairSet.exchanges.length} бирж`
  }, [pairSet])

  if (!pairSet || !selection) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 p-6">
        <LineChart size={48} className="text-muted" />
        <p className="text-muted">Набор пар не найден</p>
        <Link to="/pairs">
          <Button variant="outline">
            <ArrowLeft size={14} /> К торговым парам
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm px-5 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/pairs">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={14} /> Trading Pairs
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white truncate">{pairSet.name}</h1>
                <span className="text-sm text-muted">{pairSet.pair}</span>
                {isMonitoringPair(pairSet) ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-cyan/15 text-accent-cyan">
                    Мониторинг
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-purple/15 text-accent-purple">
                    Торговля
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {exchangeLabel} · {pairSet.exchanges.join(', ')}
              </p>
            </div>
          </div>

          {typeof livePrice === 'number' && (
            <div className="text-right">
              <p className="text-lg font-bold text-white">{formatCurrency(livePrice)}</p>
              {liveChange !== null && (
                <p className={cn('text-xs font-medium', liveChange >= 0 ? 'text-success' : 'text-error')}>
                  {liveChange >= 0 ? '+' : ''}
                  {liveChange.toFixed(2)}%
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex gap-4 p-4 min-h-0">
        <Card className="flex-1 p-4 flex flex-col min-h-0 min-w-0">
          <MultiExchangeChart
            selections={chartSelections}
            primaryPair={pairSet.pair}
            className="h-full min-h-[420px]"
            onConfigure={openPairsForm}
            chartData={chartQuery.data}
            chartLoading={chartQuery.loading}
            networks={chartQuery.networks}
            chartError={chartQuery.error}
            onChartReload={chartQuery.reload}
          />
        </Card>

        <Card className="w-72 xl:w-80 shrink-0 p-4 overflow-y-auto hidden md:block">
          <h2 className="text-sm font-semibold text-white mb-3">Цены на биржах</h2>
          <ExchangePricePanel
            pair={pairSet.pair}
            selection={selection}
            chartData={chartQuery.data}
            networks={chartQuery.networks}
          />
        </Card>
      </main>

      <Modal
        open={pairsFormOpen}
        onClose={() => setPairsFormOpen(false)}
        title="Настройка бирж на графике"
        size="xl"
        footer={
          <ModalFooter
            onCancel={() => setPairsFormOpen(false)}
            onConfirm={applyPairsForm}
            confirmLabel="Применить"
          />
        }
      >
        <AddPairsGridForm
          selections={draftSelections}
          onChange={setDraftSelections}
          mode="edit"
        />
      </Modal>
    </div>
  )
}
