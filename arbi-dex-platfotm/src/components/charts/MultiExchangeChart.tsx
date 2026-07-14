import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Layers, LineChart as LineChartIcon, RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  generateMultiPairChartData,
  getPairExchangeConfig,
  type MultiPairChartPoint,
} from '../../data/mockData'
import { useExchangeChartData } from '../../hooks/useExchangeChartData'
import { referenceNetworks, tradingNetwork } from '../../lib/buildChartNetworks'
import type { ChartPoint } from '../../services/chartDataService'
import type { NetworkSource } from '../../simulation/simulationNetworkTypes'
import type { ChartPairSelection } from '../../types/chart'
import { isMonitoringSelection, seriesKey } from '../../types/chart'
import { cn, formatCurrency } from '../../lib/utils'

type ChartViewMode = 'summary' | 'all'

const AVG_COLOR = '#D4A900'
const TRADING_BUY_COLOR = '#10B981'
const TRADING_SELL_COLOR = '#E5383B'

const PAIR_COLORS = ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6']

interface MultiExchangeChartProps {
  selections: ChartPairSelection[]
  primaryPair: string
  className?: string
  onConfigure?: () => void
  chartData?: ChartPoint[]
  chartLoading?: boolean
  networks?: NetworkSource[]
  chartError?: string | null
  onChartReload?: () => void
}

function formatChartPrice(value: number, pair: string): string {
  if (pair.includes('XRP') || pair.includes('ADA')) return `$${value.toFixed(4)}`
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `$${value.toFixed(2)}`
}

function getPairColor(pair: string, pairs: string[]): string {
  const idx = pairs.indexOf(pair)
  return PAIR_COLORS[idx >= 0 ? idx % PAIR_COLORS.length : 0]
}

export function MultiExchangeChart({
  selections,
  primaryPair,
  className,
  onConfigure,
  chartData: chartDataProp,
  chartLoading: chartLoadingProp,
  networks: networksProp,
  chartError: chartErrorProp,
  onChartReload,
}: MultiExchangeChartProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>('summary')
  const uniquePairs = [...new Set(selections.map((s) => s.pair))]
  const isMultiPair = uniquePairs.length > 1
  const primarySelection = selections.find((s) => s.pair === primaryPair) ?? selections[0]
  const config = getPairExchangeConfig(primaryPair, primarySelection?.id)
  const monitoring = primarySelection ? isMonitoringSelection(primarySelection) : config?.purpose === 'monitoring'

  const fetched = useExchangeChartData(
    !isMultiPair && chartDataProp === undefined ? primarySelection : undefined,
  )
  const liveData = chartDataProp ?? fetched.data
  const loading = chartLoadingProp ?? fetched.loading
  const networks = networksProp ?? fetched.networks
  const error = chartErrorProp ?? fetched.error
  const reload = onChartReload ?? fetched.reload

  const rawMultiData = useMemo(
    () => (isMultiPair ? generateMultiPairChartData(selections) : []),
    [selections, isMultiPair],
  )

  const multiChartData = useMemo(() => {
    if (!isMultiPair) return []
    return normalizeMultiPairData(rawMultiData, selections)
  }, [rawMultiData, selections, isMultiPair])

  const tradingNet = primarySelection ? tradingNetwork(primarySelection, networks) : undefined
  const refNets = primarySelection ? referenceNetworks(primarySelection, networks) : []

  const canToggleView = !isMultiPair && networks.length > 0

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {isMultiPair ? (
            uniquePairs.map((pair) => (
              <LegendItem
                key={pair}
                color={getPairColor(pair, uniquePairs)}
                label={pair}
                bold={pair === primaryPair}
              />
            ))
          ) : viewMode === 'summary' ? (
            <>
              <LegendItem color={AVG_COLOR} label="Среднее" dashed />
              {!monitoring && tradingNet && (
                <>
                  <LegendItem color={TRADING_BUY_COLOR} label={`${tradingNet.label} · покупка`} />
                  <LegendItem color={TRADING_SELL_COLOR} label={`${tradingNet.label} · продажа`} />
                </>
              )}
            </>
          ) : (
            networks.map((net) => (
              <div key={net.id} className="flex items-center gap-1.5">
                <LegendItem color={net.color} label={net.label} />
                <span className="text-[10px] font-mono font-bold text-success">B</span>
                <span className="text-[10px] font-mono font-bold text-error">S</span>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
          {onConfigure && (
            <Button variant="outline" size="sm" onClick={onConfigure}>
              <Settings2 size={14} />
              Пары
            </Button>
          )}
          {!isMultiPair && (
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
              Обновить
            </Button>
          )}
          {canToggleView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode((m) => (m === 'summary' ? 'all' : 'summary'))}
            >
              {viewMode === 'summary' ? (
                <>
                  <Layers size={14} />
                  Все биржи
                </>
              ) : (
                <>
                  <LineChartIcon size={14} />
                  Среднее
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {loading && !isMultiPair && liveData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted">Загрузка графика…</div>
        ) : !isMultiPair && error && liveData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
            <p className="text-sm text-error">{error}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw size={14} /> Повторить
            </Button>
          </div>
        ) : isMultiPair ? (
          <LegacyMultiPairLines
            data={multiChartData}
            selections={selections}
            primaryPair={primaryPair}
            normalized
          />
        ) : (
          <BidAskChartLines
            data={liveData}
            selection={primarySelection}
            networks={networks}
            tradingNet={tradingNet}
            viewMode={viewMode}
            monitoring={monitoring}
            primaryPair={primaryPair}
          />
        )}
      </div>

      {isMultiPair ? (
        <p className="text-[11px] text-muted mt-2">
          Несколько пар на одном графике — отображение в % изменения от начала периода.
        </p>
      ) : config ? (
        <p className="text-[11px] text-muted mt-2">
          {monitoring
            ? viewMode === 'summary'
              ? `Мониторинг — среднее по ${refNets.length} биржам (${liveData.length} точек).`
              : `Мониторинг — bid/ask на ${networks.length} биржах (${liveData.length} точек).`
            : viewMode === 'summary'
              ? `Среднее по reference-биржам (${config.priceMethod}) и bid/ask на ${config.tradingExchange}.`
              : `Bid/ask на всех ${networks.length} биржах.`}
          {error ? ` · ${error}` : ''}
        </p>
      ) : null}
    </div>
  )
}

function normalizeMultiPairData(
  data: MultiPairChartPoint[],
  selections: ChartPairSelection[],
): MultiPairChartPoint[] {
  const bases: Record<string, number> = {}

  for (const sel of selections) {
    const first = data[0]
    if (!first) continue
    bases[sel.pair] = Number(first[`${sel.pair}::trading`] ?? 1)
  }

  return data.map((point) => {
    const next: MultiPairChartPoint = { time: point.time, label: point.label }

    for (const sel of selections) {
      const base = bases[sel.pair] || 1
      const tradingKey = `${sel.pair}::trading`
      const avgKey = `${sel.pair}::average`

      next[tradingKey] = (Number(point[tradingKey] ?? 0) / base - 1) * 100
      if (point[avgKey] !== undefined) {
        next[avgKey] = (Number(point[avgKey] ?? 0) / base - 1) * 100
      }
      for (const ex of sel.selectedExchanges) {
        const key = seriesKey(sel.pair, ex)
        next[key] = (Number(point[key] ?? 0) / base - 1) * 100
      }
    }

    return next
  })
}

function LegendItem({
  color,
  label,
  bold,
  dashed,
}: {
  color: string
  label: string
  bold?: boolean
  dashed?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      <svg width="20" height="10">
        <line
          x1="0"
          y1="5"
          x2="20"
          y2="5"
          stroke={color}
          strokeWidth={bold ? 2.5 : 1.5}
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
      <span className={cn(bold && 'text-white font-medium')}>{label}</span>
    </div>
  )
}

function BidAskChartLines({
  data,
  selection,
  networks,
  tradingNet,
  viewMode,
  monitoring,
  primaryPair,
}: {
  data: ChartPoint[]
  selection?: ChartPairSelection
  networks: NetworkSource[]
  tradingNet?: NetworkSource
  viewMode: ChartViewMode
  monitoring: boolean
  primaryPair: string
}) {
  if (!selection || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-muted">Нет данных</div>
  }

  const lines: ReactElement[] = []

  if (viewMode === 'summary') {
    lines.push(
      <Line
        key="avg"
        type="stepAfter"
        dataKey="avg"
        name="Среднее"
        stroke={AVG_COLOR}
        strokeWidth={2}
        strokeDasharray="6 4"
        dot={false}
        activeDot={{ r: 4 }}
      />,
    )

    if (!monitoring && tradingNet) {
      lines.push(
        <Line
          key={`${tradingNet.id}_buy`}
          type="stepAfter"
          dataKey={`${tradingNet.id}_buy`}
          name={`${tradingNet.label} · покупка`}
          stroke={TRADING_BUY_COLOR}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />,
        <Line
          key={`${tradingNet.id}_sell`}
          type="stepAfter"
          dataKey={`${tradingNet.id}_sell`}
          name={`${tradingNet.label} · продажа`}
          stroke={TRADING_SELL_COLOR}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />,
      )
    }
  } else {
    for (const net of networks) {
      const isTrading = !monitoring && tradingNet?.id === net.id
      lines.push(
        <Line
          key={`${net.id}_buy`}
          type="stepAfter"
          dataKey={`${net.id}_buy`}
          name={`${net.label} · покупка`}
          stroke={isTrading ? TRADING_BUY_COLOR : net.color}
          strokeWidth={isTrading ? 2 : 1.5}
          strokeOpacity={isTrading ? 1 : 0.85}
          dot={false}
          activeDot={{ r: 3 }}
        />,
        <Line
          key={`${net.id}_sell`}
          type="stepAfter"
          dataKey={`${net.id}_sell`}
          name={`${net.label} · продажа`}
          stroke={isTrading ? TRADING_SELL_COLOR : net.color}
          strokeWidth={isTrading ? 2 : 1.5}
          strokeOpacity={isTrading ? 1 : 0.85}
          strokeDasharray={isTrading ? undefined : '3 2'}
          dot={false}
          activeDot={{ r: 3 }}
        />,
      )
    }
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
        <YAxis
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(v) => formatChartPrice(v, primaryPair)}
          width={72}
        />
        <Tooltip
          contentStyle={{
            background: '#172033',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
          }}
          formatter={(value, name) => [formatChartPrice(Number(value), primaryPair), String(name)]}
          labelFormatter={(label) => `Time: ${label}`}
        />
        <Legend content={() => null} />
        {lines}
      </LineChart>
    </ResponsiveContainer>
  )
}

function LegacyMultiPairLines({
  data,
  selections,
  primaryPair,
  normalized,
}: {
  data: MultiPairChartPoint[]
  selections: ChartPairSelection[]
  primaryPair: string
  normalized: boolean
}) {
  const uniquePairs = [...new Set(selections.map((s) => s.pair))]
  const yFormatter = (v: number) =>
    normalized ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : formatChartPrice(v, primaryPair)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
        <YAxis tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={yFormatter} width={normalized ? 56 : 72} />
        <Tooltip
          contentStyle={{
            background: '#172033',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
          }}
          formatter={(value, name) => {
            const str = String(name)
            if (normalized) return [`${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`, str]
            const pair = str.includes('::') ? str.split('::')[0] : primaryPair
            return [formatChartPrice(Number(value), pair), str]
          }}
          labelFormatter={(label) => `Time: ${label}`}
        />
        <Legend content={() => null} />
        {selections.flatMap((sel) => {
          const color = getPairColor(sel.pair, uniquePairs)
          const monitoringSel = isMonitoringSelection(sel)
          const result = []
          if (!monitoringSel && sel.tradingExchange) {
            result.push(
              <Line
                key={`${sel.pair}::trading`}
                type="stepAfter"
                dataKey={`${sel.pair}::trading`}
                name={`${sel.pair} · ${sel.tradingExchange}`}
                stroke={color}
                strokeWidth={sel.pair === primaryPair ? 2.5 : 2}
                dot={false}
                activeDot={{ r: 4 }}
              />,
            )
          }
          if (monitoringSel || sel.selectedExchanges.some((e) => e !== sel.tradingExchange)) {
            result.push(
              <Line
                key={`${sel.pair}::average`}
                type="stepAfter"
                dataKey={`${sel.pair}::average`}
                name={`${sel.pair} · avg`}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.7}
                dot={false}
              />,
            )
          }
          return result
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ExchangePricePanel({
  pair,
  selection,
  chartData,
  networks: networksProp,
}: {
  pair: string
  selection?: ChartPairSelection
  chartData?: ChartPoint[]
  networks?: NetworkSource[]
}) {
  const fetched = useExchangeChartData(chartData !== undefined ? undefined : selection)
  const data = chartData ?? fetched.data
  const networks = networksProp ?? fetched.networks
  const config = getPairExchangeConfig(pair, selection?.id)
  const latest = data[data.length - 1]
  const sel = selection

  if (!config || !sel || !latest) return null

  const monitoring = sel.purpose === 'monitoring' || !sel.tradingExchange
  const refNets = referenceNetworks(sel, networks)
  const tradingNet = tradingNetwork(sel, networks)

  const spread =
    !monitoring && tradingNet && latest.avg !== undefined
      ? Math.abs(
          Number(latest[`${tradingNet.id}_buy`] ?? 0) -
            Number(latest[`${tradingNet.id}_sell`] ?? 0),
        )
      : refNets.length > 1
        ? Math.max(
            ...refNets.map((net) => Number(latest[`${net.id}_buy`] ?? latest[`${net.id}_sell`] ?? 0)),
          ) -
          Math.min(
            ...refNets.map((net) => Number(latest[`${net.id}_sell`] ?? latest[`${net.id}_buy`] ?? 0)),
          )
        : 0

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between items-center p-2.5 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20">
        <div>
          <p className="text-xs text-muted">Среднее ({config.priceMethod})</p>
          <p className="text-xs text-muted">{refNets.map((n) => n.label).join(', ')}</p>
        </div>
        <p className="font-bold text-accent-cyan">{formatCurrency(Number(latest.avg ?? 0))}</p>
      </div>

      {!monitoring && tradingNet && (
        <div className="p-2.5 rounded-xl bg-accent-purple/10 border border-accent-purple/20 space-y-1.5">
          <p className="text-xs text-muted">Торговая · {tradingNet.label}</p>
          <div className="flex justify-between">
            <span className="text-success text-xs font-mono font-bold">BUY</span>
            <span className="text-white">{formatCurrency(Number(latest[`${tradingNet.id}_buy`] ?? 0))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-error text-xs font-mono font-bold">SELL</span>
            <span className="text-white">{formatCurrency(Number(latest[`${tradingNet.id}_sell`] ?? 0))}</span>
          </div>
        </div>
      )}

      {networks.map((net) => (
        <div key={net.id} className="px-2.5 py-1.5 rounded-lg bg-surface/50">
          <p className="text-xs text-muted mb-1">{net.label}</p>
          <div className="flex justify-between text-xs">
            <span className="text-success font-mono">B</span>
            <span className="text-white">{formatCurrency(Number(latest[`${net.id}_buy`] ?? 0))}</span>
          </div>
          <div className="flex justify-between text-xs mt-0.5">
            <span className="text-error font-mono">S</span>
            <span className="text-white">{formatCurrency(Number(latest[`${net.id}_sell`] ?? 0))}</span>
          </div>
        </div>
      ))}

      {(refNets.length > 1 || (!monitoring && tradingNet)) && (
        <div className="flex justify-between px-2.5 pt-1 border-t border-border text-xs">
          <span className="text-muted">{monitoring ? 'Spread' : 'Spread bid/ask'}</span>
          <span className="text-warning">{formatCurrency(spread)}</span>
        </div>
      )}
    </div>
  )
}
