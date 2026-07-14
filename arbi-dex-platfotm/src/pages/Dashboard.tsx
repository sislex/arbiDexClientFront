import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Bot, Brain, ArrowLeftRight, Plus, TrendingUp } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { KpiCard } from '../components/ui/KpiCard'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import {
  generateEquityCurve,
  generateDailyProfit,
  BOT_DISTRIBUTION,
  RECENT_EVENTS,
  getBots,
  type Bot as BotRecord,
} from '../data/mockData'
import { cn, formatCurrency, formatPercent } from '../lib/utils'
import { Link } from 'react-router-dom'
import { SortableTableHead } from '../components/ui/SortableTableHead'
import { useTableSort } from '../hooks/useTableSort'

type DashboardBotSortKey = 'name' | 'pair' | 'strategy' | 'profit' | 'roi' | 'status'

function getDashboardBotSortValue(bot: BotRecord, key: DashboardBotSortKey) {
  switch (key) {
    case 'name':
      return bot.name
    case 'pair':
      return bot.pair
    case 'strategy':
      return bot.strategy
    case 'profit':
      return bot.profit
    case 'roi':
      return bot.roi
    case 'status':
      return bot.status
  }
}

const equityData = generateEquityCurve()
const dailyProfit = generateDailyProfit()

export function DashboardPage() {
  const { sortKey, direction, toggleSort, sort } = useTableSort<DashboardBotSortKey>('profit', 'desc')
  const topBots = sort(getBots(), getDashboardBotSortValue).slice(0, 5)

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Обзор вашей торговой автоматизации"
        actions={
          <Link to="/bots">
            <Button size="lg">
              <Plus size={16} />
              Добавить бота
            </Button>
          </Link>
        }
      />
      <PageContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Total Profit" value={12847} change={12.4} />
          <KpiCard label="Today's Profit" value={342} change={2.8} />
          <KpiCard label="Active Bots" value="8" suffix="/ 10" />
          <KpiCard label="Running Strategies" value={6} />
          <KpiCard label="Total Trades" value="2,847" />
          <KpiCard label="Win Rate" value="68.2%" change={1.2} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Equity Curve</CardTitle>
              <span className="text-xs text-success font-medium flex items-center gap-1">
                <TrendingUp size={12} /> +12.4% за 30д
              </span>
            </CardHeader>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#172033', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}
                  formatter={(v) => [formatCurrency(Number(v)), 'Equity']}
                />
                <Area type="stepAfter" dataKey="equity" stroke="#7C3AED" strokeWidth={2} fill="url(#equityGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bot Distribution</CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={BOT_DISTRIBUTION} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                  {BOT_DISTRIBUTION.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#172033', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {BOT_DISTRIBUTION.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Daily Profit</CardTitle>
            </CardHeader>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyProfit}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#172033', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }} />
                <Bar dataKey="profit" fill="#06B6D4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Top Bot</CardTitle></CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-purple/15 flex items-center justify-center">
                  <Bot size={20} className="text-accent-purple" />
                </div>
                <div>
                  <p className="font-semibold text-white">BTC Trend</p>
                  <p className="text-sm text-success">{formatCurrency(3450)} · {formatPercent(22.7)}</p>
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader><CardTitle>Best Strategy</CardTitle></CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-cyan/15 flex items-center justify-center">
                  <Brain size={20} className="text-accent-cyan" />
                </div>
                <div>
                  <p className="font-semibold text-white">Breakout</p>
                  <p className="text-sm text-success">{formatPercent(28.3)} ROI</p>
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader><CardTitle>Best Pair</CardTitle></CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
                  <ArrowLeftRight size={20} className="text-success" />
                </div>
                <div>
                  <p className="font-semibold text-white">SOL/USDT</p>
                  <p className="text-sm text-success">{formatPercent(28.3)} ROI</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Top Bots</CardTitle></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-left border-b border-border">
                    <SortableTableHead label="Bot" column="name" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as DashboardBotSortKey)} className="pb-3" />
                    <SortableTableHead label="Pair" column="pair" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as DashboardBotSortKey)} className="pb-3" />
                    <SortableTableHead label="Strategy" column="strategy" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as DashboardBotSortKey)} className="pb-3" />
                    <SortableTableHead label="Profit" column="profit" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as DashboardBotSortKey)} className="pb-3" align="right" />
                    <SortableTableHead label="ROI" column="roi" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as DashboardBotSortKey)} className="pb-3" align="right" />
                    <SortableTableHead label="Status" column="status" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as DashboardBotSortKey)} className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {topBots.map((bot) => (
                    <tr key={bot.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-medium text-white">{bot.name}</td>
                      <td className="py-3 text-muted">{bot.pair}</td>
                      <td className="py-3 text-muted">{bot.strategy}</td>
                      <td className={cn('py-3 text-right font-medium', bot.profit >= 0 ? 'text-success' : 'text-error')}>
                        {formatCurrency(bot.profit)}
                      </td>
                      <td className={cn('py-3 text-right', bot.roi >= 0 ? 'text-success' : 'text-error')}>
                        {formatPercent(bot.roi)}
                      </td>
                      <td className="py-3"><StatusBadge status={bot.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Events</CardTitle></CardHeader>
            <div className="space-y-3">
              {RECENT_EVENTS.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    event.type === 'buy' && 'bg-accent-cyan',
                    event.type === 'sell' && 'bg-accent-purple',
                    event.type === 'profit' && 'bg-success',
                    event.type === 'pause' && 'bg-warning',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300">{event.text}</p>
                    <p className="text-xs text-muted mt-0.5">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-3">
            <Link to="/bots"><Button variant="secondary"><Plus size={16} /> Добавить бота</Button></Link>
            <Link to="/strategies"><Button variant="outline"><Brain size={16} /> Новая стратегия</Button></Link>
            <Link to="/pairs"><Button variant="outline"><ArrowLeftRight size={16} /> Добавить пару</Button></Link>
            <Link to="/live"><Button variant="outline"><Bot size={16} /> Live Trading</Button></Link>
          </div>
        </Card>
      </PageContent>
    </>
  )
}
