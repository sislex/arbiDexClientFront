import { useMemo, useState } from 'react'
import { Download, Filter } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { SearchInput, Select } from '../components/ui/SearchInput'
import { Tabs } from '../components/ui/Tabs'
import { SortableTableHead } from '../components/ui/SortableTableHead'
import {
  ResizableTable,
  TABLE_CELL,
  TABLE_HEAD,
  type ResizableColumnConfig,
} from '../components/ui/ResizableTable'
import { TRADE_HISTORY } from '../data/mockData'
import { useTableSort } from '../hooks/useTableSort'
import { cn, formatCurrency } from '../lib/utils'

type TradeSortKey = 'time' | 'bot' | 'pair' | 'side' | 'price' | 'amount' | 'profit' | 'status'

const HISTORY_TRADES_COLUMNS: ResizableColumnConfig[] = [
  { id: 'time', defaultPercent: 14, minPercent: 10 },
  { id: 'bot', defaultPercent: 14, minPercent: 10 },
  { id: 'pair', defaultPercent: 10, minPercent: 8 },
  { id: 'side', defaultPercent: 8, minPercent: 6 },
  { id: 'price', defaultPercent: 12, minPercent: 9 },
  { id: 'amount', defaultPercent: 10, minPercent: 8 },
  { id: 'profit', defaultPercent: 12, minPercent: 9 },
  { id: 'status', defaultPercent: 10, minPercent: 8 },
]

function getTradeSortValue(trade: (typeof TRADE_HISTORY)[number], key: TradeSortKey) {
  switch (key) {
    case 'time':
      return trade.time
    case 'bot':
      return trade.bot
    case 'pair':
      return trade.pair
    case 'side':
      return trade.side
    case 'price':
      return trade.price
    case 'amount':
      return trade.amount
    case 'profit':
      return trade.profit ?? -Infinity
    case 'status':
      return trade.status
  }
}

export function HistoryPage() {
  const [tab, setTab] = useState('trades')
  const [search, setSearch] = useState('')
  const { sortKey, direction, toggleSort, sort } = useTableSort<TradeSortKey>()

  const filtered = useMemo(
    () =>
      sort(
        TRADE_HISTORY.filter(
          (t) => !search || t.bot.toLowerCase().includes(search.toLowerCase()) || t.pair.toLowerCase().includes(search.toLowerCase()),
        ),
        getTradeSortValue,
      ),
    [search, sort],
  )

  return (
    <>
      <PageHeader
        title="History"
        subtitle="История сделок, логов и ошибок"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download size={14} /> CSV</Button>
            <Button variant="outline" size="sm"><Download size={14} /> JSON</Button>
          </div>
        }
      />
      <PageContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            tabs={[
              { id: 'trades', label: 'Trades' },
              { id: 'logs', label: 'Logs' },
              { id: 'errors', label: 'Errors' },
            ]}
            active={tab}
            onChange={setTab}
          />
          <SearchInput value={search} onChange={setSearch} className="w-64" placeholder="Поиск..." />
          <Select value="all" onChange={() => {}} options={[
            { value: 'all', label: 'Все пары' },
            { value: 'btc', label: 'BTC/USDT' },
            { value: 'eth', label: 'ETH/USDT' },
          ]} />
          <Button variant="outline" size="sm"><Filter size={14} /> Advanced Filters</Button>
        </div>

        {tab === 'trades' && (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-hidden">
              <ResizableTable tableId="history-trades" columns={HISTORY_TRADES_COLUMNS} className="text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-muted text-left border-b border-border">
                    <SortableTableHead label="Time" column="time" columnId="time" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as TradeSortKey)} className={TABLE_HEAD} />
                    <SortableTableHead label="Bot" column="bot" columnId="bot" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as TradeSortKey)} className={TABLE_HEAD} />
                    <SortableTableHead label="Pair" column="pair" columnId="pair" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as TradeSortKey)} className={TABLE_HEAD} />
                    <SortableTableHead label="Side" column="side" columnId="side" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as TradeSortKey)} className={TABLE_HEAD} />
                    <SortableTableHead label="Price" column="price" columnId="price" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as TradeSortKey)} className={TABLE_HEAD} align="right" />
                    <SortableTableHead label="Amount" column="amount" columnId="amount" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as TradeSortKey)} className={TABLE_HEAD} align="right" />
                    <SortableTableHead label="Profit" column="profit" columnId="profit" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as TradeSortKey)} className={TABLE_HEAD} align="right" />
                    <SortableTableHead label="Status" column="status" columnId="status" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as TradeSortKey)} className={TABLE_HEAD} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((trade) => (
                    <tr key={trade.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className={cn(TABLE_CELL, 'text-muted font-mono text-[11px] truncate')}>{trade.time}</td>
                      <td className={cn(TABLE_CELL, 'font-medium text-white truncate')}>{trade.bot}</td>
                      <td className={cn(TABLE_CELL, 'text-muted truncate')}>{trade.pair}</td>
                      <td className={TABLE_CELL}>
                        <span className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-medium uppercase whitespace-nowrap',
                          trade.side === 'buy' ? 'bg-accent-cyan/15 text-accent-cyan' : 'bg-accent-purple/15 text-accent-purple',
                        )}>
                          {trade.side}
                        </span>
                      </td>
                      <td className={cn(TABLE_CELL, 'text-right text-white')}>{formatCurrency(trade.price)}</td>
                      <td className={cn(TABLE_CELL, 'text-right text-muted')}>{trade.amount}</td>
                      <td className={cn(TABLE_CELL, 'text-right')}>
                        {trade.profit !== null ? (
                          <span className={trade.profit >= 0 ? 'text-success' : 'text-error'}>
                            {trade.profit >= 0 ? '+' : ''}{formatCurrency(trade.profit)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className={TABLE_CELL}>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap',
                          trade.status === 'open' ? 'bg-accent-cyan/15 text-accent-cyan' : 'bg-white/5 text-muted',
                        )}>
                          {trade.status === 'open' ? 'Open' : 'Closed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResizableTable>
            </div>
          </Card>
        )}

        {tab === 'logs' && (
          <Card>
            <div className="space-y-2 font-mono text-xs">
              <p className="text-muted">[2025-07-09 11:14:02] BTC Scalper: Order filled BUY 0.015 @ 67420</p>
              <p className="text-muted">[2025-07-09 11:09:45] ETH Scalper: Order filled SELL 0.5 @ 3842</p>
              <p className="text-muted">[2025-07-09 10:57:12] XRP Arbitrage: Cross-exchange trade executed</p>
              <p className="text-muted">[2025-07-09 10:42:01] SOL Breakout: Signal detected, entering position</p>
              <p className="text-muted">[2025-07-09 10:30:33] BNB Trend: Take profit triggered</p>
            </div>
          </Card>
        )}

        {tab === 'errors' && (
          <Card>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-error/5 border border-error/10">
                <p className="text-error font-medium text-sm">API Rate Limit Exceeded</p>
                <p className="text-xs text-muted mt-1">SOL Scalper · 2025-07-08 14:32:15</p>
              </div>
              <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
                <p className="text-warning font-medium text-sm">Insufficient Balance</p>
                <p className="text-xs text-muted mt-1">ADA Mean Rev · 2025-07-07 09:15:42</p>
              </div>
            </div>
          </Card>
        )}
      </PageContent>
    </>
  )
}
