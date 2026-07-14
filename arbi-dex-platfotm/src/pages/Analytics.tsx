import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Tabs } from '../components/ui/Tabs'
import { SortableTableHead } from '../components/ui/SortableTableHead'
import { StrategyMatrix } from '../components/StrategyMatrix'
import {
  generateEquityCurve,
  BOT_DISTRIBUTION,
  STRATEGY_DATA,
  getBots,
  PAIRS,
} from '../data/mockData'
import { cn, formatPercent, formatCurrency } from '../lib/utils'
import { useTableSort } from '../hooks/useTableSort'
import type { Bot } from '../data/mockData'

type StrategyAnalyticsSortKey = 'name' | 'roi' | 'winRate' | 'sharpe'

type PairComparisonRow = {
  pair: string
  bots: number
  profit: number
  avgRoi: number
  avgWin: number
}

type PairComparisonSortKey = 'pair' | 'bots' | 'profit' | 'avgRoi' | 'avgWin'

type BotRankSortKey = 'rank' | 'name' | 'profit' | 'roi' | 'winRate' | 'drawdown'

function getStrategyAnalyticsSortValue(
  s: (typeof STRATEGY_DATA)[number],
  key: StrategyAnalyticsSortKey,
) {
  switch (key) {
    case 'name':
      return s.name
    case 'roi':
      return s.roi
    case 'winRate':
      return s.winRate
    case 'sharpe':
      return s.sharpe
  }
}

function getPairComparisonSortValue(row: PairComparisonRow, key: PairComparisonSortKey) {
  switch (key) {
    case 'pair':
      return row.pair
    case 'bots':
      return row.bots
    case 'profit':
      return row.profit
    case 'avgRoi':
      return row.avgRoi
    case 'avgWin':
      return row.avgWin
  }
}

function getBotRankSortValue(bot: Bot, key: BotRankSortKey) {
  switch (key) {
    case 'rank':
      return bot.profit
    case 'name':
      return bot.name
    case 'profit':
      return bot.profit
    case 'roi':
      return bot.roi
    case 'winRate':
      return bot.winRate
    case 'drawdown':
      return bot.drawdown
  }
}

const equityData = generateEquityCurve()

const pairPerformance = PAIRS.slice(0, 5).map((p) => ({
  pair: p.split('/')[0],
  profit: getBots().filter((b) => b.pair === p).reduce((s, b) => s + b.profit, 0),
}))

const scatterData = STRATEGY_DATA.map((s) => ({
  name: s.name,
  risk: s.drawdown,
  profit: s.roi,
}))

export function AnalyticsPage() {
  const [tab, setTab] = useState('overview')
  const strategySort = useTableSort<StrategyAnalyticsSortKey>()
  const pairSort = useTableSort<PairComparisonSortKey>()
  const botRankSort = useTableSort<BotRankSortKey>('profit', 'desc')

  const sortedStrategies = useMemo(
    () => strategySort.sort(STRATEGY_DATA, getStrategyAnalyticsSortValue),
    [strategySort.sort],
  )

  const pairRows = useMemo<PairComparisonRow[]>(
    () =>
      PAIRS.slice(0, 5).map((pair) => {
        const bots = getBots().filter((b) => b.pair === pair)
        const profit = bots.reduce((s, b) => s + b.profit, 0)
        const avgRoi = bots.length ? bots.reduce((s, b) => s + b.roi, 0) / bots.length : 0
        const avgWin = bots.length ? bots.reduce((s, b) => s + b.winRate, 0) / bots.length : 0
        return { pair, bots: bots.length, profit, avgRoi, avgWin }
      }),
    [],
  )

  const sortedPairRows = useMemo(
    () => pairSort.sort(pairRows, getPairComparisonSortValue),
    [pairRows, pairSort.sort],
  )

  const sortedBots = useMemo(
    () => botRankSort.sort(getBots(), getBotRankSortValue),
    [botRankSort.sort],
  )

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Глубокий анализ производительности"
      />
      <PageContent className="space-y-6">
        <Tabs
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'strategies', label: 'Strategies' },
            { id: 'pairs', label: 'Pairs' },
            { id: 'bots', label: 'Bots' },
            { id: 'matrix', label: 'Effectiveness Matrix' },
            { id: 'errors', label: 'Errors' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>Equity</CardTitle></CardHeader>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={equityData}>
                    <defs>
                      <linearGradient id="aEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#172033', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }} />
                    <Area type="stepAfter" dataKey="equity" stroke="#7C3AED" fill="url(#aEquity)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <CardHeader><CardTitle>Bot Distribution</CardTitle></CardHeader>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={BOT_DISTRIBUTION} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                      {BOT_DISTRIBUTION.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#172033', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Profit by Pair</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pairPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pair" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#172033', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }} formatter={(v) => [formatCurrency(Number(v)), 'Profit']} />
                  <Bar dataKey="profit" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}

        {tab === 'strategies' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Risk vs Profit</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="risk" name="Risk" unit="%" tickLine={false} axisLine={false} />
                  <YAxis type="number" dataKey="profit" name="ROI" unit="%" tickLine={false} axisLine={false} />
                  <ZAxis range={[100, 100]} />
                  <Tooltip contentStyle={{ background: '#172033', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }} />
                  <Scatter data={scatterData} fill="#7C3AED" />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
            <Card className="overflow-hidden p-0">
              <div className="px-5 py-4 border-b border-border"><CardTitle>Strategy Comparison</CardTitle></div>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-muted border-b border-border">
                    <SortableTableHead label="Strategy" column="name" sortKey={strategySort.sortKey} direction={strategySort.direction} onSort={(col) => strategySort.toggleSort(col as StrategyAnalyticsSortKey)} className="px-5 py-3" />
                    <SortableTableHead label="ROI" column="roi" sortKey={strategySort.sortKey} direction={strategySort.direction} onSort={(col) => strategySort.toggleSort(col as StrategyAnalyticsSortKey)} className="px-5 py-3" align="right" />
                    <SortableTableHead label="Win Rate" column="winRate" sortKey={strategySort.sortKey} direction={strategySort.direction} onSort={(col) => strategySort.toggleSort(col as StrategyAnalyticsSortKey)} className="px-5 py-3" align="right" />
                    <SortableTableHead label="Sharpe" column="sharpe" sortKey={strategySort.sortKey} direction={strategySort.direction} onSort={(col) => strategySort.toggleSort(col as StrategyAnalyticsSortKey)} className="px-5 py-3" align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedStrategies.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-medium text-white">{s.name}</td>
                      <td className={cn('px-5 py-3 text-right', s.roi >= 0 ? 'text-success' : 'text-error')}>{formatPercent(s.roi)}</td>
                      <td className="px-5 py-3 text-right text-white">{s.winRate}%</td>
                      <td className="px-5 py-3 text-right text-white">{s.sharpe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === 'pairs' && (
          <Card className="overflow-hidden p-0">
            <div className="px-5 py-4 border-b border-border"><CardTitle>Pair Comparison</CardTitle></div>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted border-b border-border">
                  <SortableTableHead label="Pair" column="pair" sortKey={pairSort.sortKey} direction={pairSort.direction} onSort={(col) => pairSort.toggleSort(col as PairComparisonSortKey)} className="px-5 py-3" />
                  <SortableTableHead label="Bots" column="bots" sortKey={pairSort.sortKey} direction={pairSort.direction} onSort={(col) => pairSort.toggleSort(col as PairComparisonSortKey)} className="px-5 py-3" align="right" />
                  <SortableTableHead label="Total Profit" column="profit" sortKey={pairSort.sortKey} direction={pairSort.direction} onSort={(col) => pairSort.toggleSort(col as PairComparisonSortKey)} className="px-5 py-3" align="right" />
                  <SortableTableHead label="Avg ROI" column="avgRoi" sortKey={pairSort.sortKey} direction={pairSort.direction} onSort={(col) => pairSort.toggleSort(col as PairComparisonSortKey)} className="px-5 py-3" align="right" />
                  <SortableTableHead label="Win Rate" column="avgWin" sortKey={pairSort.sortKey} direction={pairSort.direction} onSort={(col) => pairSort.toggleSort(col as PairComparisonSortKey)} className="px-5 py-3" align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedPairRows.map((row) => (
                  <tr key={row.pair} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-white">{row.pair}</td>
                    <td className="px-5 py-3 text-right text-white">{row.bots}</td>
                    <td className={cn('px-5 py-3 text-right font-medium', row.profit >= 0 ? 'text-success' : 'text-error')}>{formatCurrency(row.profit)}</td>
                    <td className={cn('px-5 py-3 text-right', row.avgRoi >= 0 ? 'text-success' : 'text-error')}>{formatPercent(row.avgRoi)}</td>
                    <td className="px-5 py-3 text-right text-white">{row.avgWin.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'bots' && (
          <Card className="overflow-hidden p-0">
            <div className="px-5 py-4 border-b border-border"><CardTitle>Bot Ranking</CardTitle></div>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted border-b border-border">
                  <SortableTableHead label="#" column="rank" sortKey={botRankSort.sortKey} direction={botRankSort.direction} onSort={(col) => botRankSort.toggleSort(col as BotRankSortKey)} className="px-5 py-3" />
                  <SortableTableHead label="Bot" column="name" sortKey={botRankSort.sortKey} direction={botRankSort.direction} onSort={(col) => botRankSort.toggleSort(col as BotRankSortKey)} className="px-5 py-3" />
                  <SortableTableHead label="Profit" column="profit" sortKey={botRankSort.sortKey} direction={botRankSort.direction} onSort={(col) => botRankSort.toggleSort(col as BotRankSortKey)} className="px-5 py-3" align="right" />
                  <SortableTableHead label="ROI" column="roi" sortKey={botRankSort.sortKey} direction={botRankSort.direction} onSort={(col) => botRankSort.toggleSort(col as BotRankSortKey)} className="px-5 py-3" align="right" />
                  <SortableTableHead label="Win Rate" column="winRate" sortKey={botRankSort.sortKey} direction={botRankSort.direction} onSort={(col) => botRankSort.toggleSort(col as BotRankSortKey)} className="px-5 py-3" align="right" />
                  <SortableTableHead label="Drawdown" column="drawdown" sortKey={botRankSort.sortKey} direction={botRankSort.direction} onSort={(col) => botRankSort.toggleSort(col as BotRankSortKey)} className="px-5 py-3" align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedBots.map((bot, i) => (
                  <tr key={bot.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-muted">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-white">{bot.name}</td>
                    <td className={cn('px-5 py-3 text-right font-medium', bot.profit >= 0 ? 'text-success' : 'text-error')}>{formatCurrency(bot.profit)}</td>
                    <td className={cn('px-5 py-3 text-right', bot.roi >= 0 ? 'text-success' : 'text-error')}>{formatPercent(bot.roi)}</td>
                    <td className="px-5 py-3 text-right text-white">{bot.winRate}%</td>
                    <td className="px-5 py-3 text-right text-warning">{bot.drawdown}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'matrix' && <StrategyMatrix />}

        {tab === 'errors' && (
          <Card>
            <CardHeader><CardTitle>Error Log</CardTitle></CardHeader>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-error/5 border border-error/10">
                <p className="text-error font-medium">API Rate Limit — SOL Scalper</p>
                <p className="text-muted text-xs mt-1">2025-07-08 14:32 · Bybit API returned 429</p>
              </div>
              <div className="p-3 rounded-xl bg-warning/5 border border-warning/10">
                <p className="text-warning font-medium">Insufficient Balance — ADA Mean Rev</p>
                <p className="text-muted text-xs mt-1">2025-07-07 09:15 · Order rejected</p>
              </div>
              <p className="text-muted text-center py-4">2 errors in the last 7 days</p>
            </div>
          </Card>
        )}
      </PageContent>
    </>
  )
}
