import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { SearchInput } from '../components/ui/SearchInput'
import { StatusBadge } from '../components/ui/Badge'
import { SortableTableHead } from '../components/ui/SortableTableHead'
import {
  ResizableTable,
  TableHeadCell,
  TABLE_ACTIONS_CELL,
  TABLE_CELL,
  TABLE_HEAD,
  type ResizableColumnConfig,
} from '../components/ui/ResizableTable'
import { STORE_STRATEGIES, getBots, type StrategyData, type StoreStrategy } from '../data/mockData'
import { useTableSort } from '../hooks/useTableSort'
import { useUndoDelete } from '../context/UndoDeleteContext'
import { loadStrategies } from '../lib/strategiesStorage'
import { buildStrategyBotCountMap } from '../lib/botCounts'
import { cn, formatPercent } from '../lib/utils'

const TOP_LIMIT = 5

const STRATEGIES_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultPercent: 26, minPercent: 14 },
  { id: 'roi', defaultPercent: 10, minPercent: 7 },
  { id: 'winRate', defaultPercent: 11, minPercent: 8 },
  { id: 'drawdown', defaultPercent: 11, minPercent: 8 },
  { id: 'runningBots', defaultPercent: 9, minPercent: 6 },
  { id: 'status', defaultPercent: 11, minPercent: 8 },
  { id: 'actions', defaultPercent: 12, minPercent: 10 },
]

type StrategySortKey = 'name' | 'roi' | 'winRate' | 'drawdown' | 'runningBots' | 'status'

function TopYourStrategiesList({ items }: { items: StrategyData[] }) {
  return (
    <div className="space-y-2">
      {items.map((s, i) => (
        <Link
          key={s.id}
          to={`/strategies/${s.id}/edit`}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-surface/60 hover:bg-surface transition-colors"
        >
          <span className="w-6 h-6 rounded-lg bg-accent-purple/15 text-accent-purple text-xs font-bold flex items-center justify-center shrink-0">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{s.name}</p>
            <p className="text-[11px] text-muted">{s.runningBots} ботов · Win {s.winRate}%</p>
          </div>
          <span className={cn('text-sm font-semibold shrink-0', s.roi >= 0 ? 'text-success' : 'text-error')}>
            {formatPercent(s.roi)}
          </span>
        </Link>
      ))}
    </div>
  )
}

function TopStoreStrategiesList({ items }: { items: StoreStrategy[] }) {
  return (
    <div className="space-y-2">
      {items.map((s, i) => (
        <div
          key={s.id}
          className="flex items-start gap-3 p-2.5 rounded-xl bg-surface/60 hover:bg-surface transition-colors"
        >
          <span className="w-6 h-6 rounded-lg bg-accent-cyan/15 text-accent-cyan text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-white truncate">{s.name}</p>
              <span
                className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
                  s.purchased
                    ? 'bg-success/15 text-success'
                    : 'bg-white/5 text-muted border border-border',
                )}
              >
                {s.purchased ? 'Куплена' : 'Не куплена'}
              </span>
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              {s.usageCount.toLocaleString('ru-RU')} пользователей
            </p>
          </div>
          <span className={cn('text-sm font-semibold shrink-0', s.roi >= 0 ? 'text-success' : 'text-error')}>
            {formatPercent(s.roi)}
          </span>
        </div>
      ))}
    </div>
  )
}

function getStrategySortValue(s: StrategyData, key: StrategySortKey) {
  switch (key) {
    case 'name':
      return s.name
    case 'roi':
      return s.roi
    case 'winRate':
      return s.winRate
    case 'drawdown':
      return s.drawdown
    case 'runningBots':
      return s.runningBots
    case 'status':
      return s.status
  }
}

export function StrategiesPage() {
  const navigate = useNavigate()
  const [strategies, setStrategies] = useState<StrategyData[]>(() => loadStrategies())
  const [search, setSearch] = useState('')
  const { sortKey, direction, toggleSort, sort } = useTableSort<StrategySortKey>()
  const { scheduleDelete, isEntityPending, deleteRevision, pendingKeys } = useUndoDelete()

  useEffect(() => {
    setStrategies(loadStrategies())
  }, [deleteRevision])

  const bots = useMemo(() => getBots(), [deleteRevision])

  const strategiesWithBotCounts = useMemo(() => {
    const counts = buildStrategyBotCountMap(bots, strategies)
    return strategies.map((strategy) => ({
      ...strategy,
      runningBots: counts.get(strategy.id) ?? 0,
    }))
  }, [bots, strategies])

  const filtered = useMemo(
    () =>
      sort(
        strategiesWithBotCounts.filter(
          (s) =>
            !isEntityPending('strategy', s.id) &&
            (!search || s.name.toLowerCase().includes(search.toLowerCase())),
        ),
        getStrategySortValue,
      ),
    [strategiesWithBotCounts, search, sort, pendingKeys, isEntityPending],
  )

  const topYourStrategies = [...strategiesWithBotCounts]
    .filter((s) => !isEntityPending('strategy', s.id))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, TOP_LIMIT)
  const topStoreStrategies = [...STORE_STRATEGIES].sort((a, b) => b.roi - a.roi).slice(0, TOP_LIMIT)

  const handleDeleteStrategy = (strategy: StrategyData, e: React.MouseEvent) => {
    e.stopPropagation()
    scheduleDelete({
      entityType: 'strategy',
      entityId: strategy.id,
      message: `Стратегия «${strategy.name}» будет удалена`,
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Strategies"
        subtitle="Библиотека торговых стратегий"
        actions={
          <Button onClick={() => navigate('/strategies/new')}>
            <Plus size={16} /> Добавить стратегию
          </Button>
        }
      />
      <PageContent className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-1 flex-col min-h-0 min-w-0 gap-5">
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <SearchInput
              value={search}
              onChange={setSearch}
              className="flex-1 min-w-0"
              placeholder="Поиск стратегий..."
            />
          </div>

          <div className="flex flex-1 min-h-0 min-w-0 gap-4">
            <div className="flex-[7] min-w-0 flex flex-col min-h-0">
              <Card className="flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                  <ResizableTable
                    tableId="strategies"
                    columns={STRATEGIES_TABLE_COLUMNS}
                    className="text-xs"
                  >
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="text-muted text-left border-b border-border">
                        <SortableTableHead
                          label="Name"
                          column="name"
                          columnId="name"
                          sortKey={sortKey}
                          direction={direction}
                          onSort={(col) => toggleSort(col as StrategySortKey)}
                          className={TABLE_HEAD}
                        />
                        <SortableTableHead
                          label="ROI"
                          column="roi"
                          columnId="roi"
                          sortKey={sortKey}
                          direction={direction}
                          onSort={(col) => toggleSort(col as StrategySortKey)}
                          className={TABLE_HEAD}
                          align="right"
                        />
                        <SortableTableHead
                          label="Win Rate"
                          column="winRate"
                          columnId="winRate"
                          sortKey={sortKey}
                          direction={direction}
                          onSort={(col) => toggleSort(col as StrategySortKey)}
                          className={TABLE_HEAD}
                          align="right"
                        />
                        <SortableTableHead
                          label="Drawdown"
                          column="drawdown"
                          columnId="drawdown"
                          sortKey={sortKey}
                          direction={direction}
                          onSort={(col) => toggleSort(col as StrategySortKey)}
                          className={TABLE_HEAD}
                          align="right"
                        />
                        <SortableTableHead
                          label="Bots"
                          column="runningBots"
                          columnId="runningBots"
                          sortKey={sortKey}
                          direction={direction}
                          onSort={(col) => toggleSort(col as StrategySortKey)}
                          className={TABLE_HEAD}
                          align="center"
                        />
                        <SortableTableHead
                          label="Status"
                          column="status"
                          columnId="status"
                          sortKey={sortKey}
                          direction={direction}
                          onSort={(col) => toggleSort(col as StrategySortKey)}
                          className={TABLE_HEAD}
                        />
                        <TableHeadCell columnId="actions" className={TABLE_HEAD} align="center">
                          Actions
                        </TableHeadCell>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => navigate(`/strategies/${s.id}/edit`)}
                          className="border-b border-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        >
                          <td className={TABLE_CELL}>
                            <p className="font-semibold text-white truncate">{s.name}</p>
                            <p className="text-[11px] text-muted mt-0.5 truncate">{s.description}</p>
                          </td>
                          <td className={cn(TABLE_CELL, 'text-right font-medium', s.roi >= 0 ? 'text-success' : 'text-error')}>
                            {formatPercent(s.roi)}
                          </td>
                          <td className={cn(TABLE_CELL, 'text-right text-white')}>{s.winRate}%</td>
                          <td className={cn(TABLE_CELL, 'text-right text-warning')}>{s.drawdown}%</td>
                          <td className={cn(TABLE_CELL, 'text-center text-white')}>{s.runningBots}</td>
                          <td className={TABLE_CELL}><StatusBadge status={s.status} /></td>
                          <td className={TABLE_ACTIONS_CELL} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-0.5">
                              <Link
                                to={`/strategies/${s.id}/edit`}
                                className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-white shrink-0"
                                title="Редактировать"
                              >
                                <Edit2 size={13} />
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteStrategy(s, e)}
                                className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-error shrink-0"
                                title="Удалить"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </ResizableTable>
                </div>
              </Card>
            </div>

            <div className="flex-[3] min-w-0 flex flex-col gap-4 overflow-y-auto min-h-0">
              <Card>
                <CardHeader><CardTitle>ТОП ваших стратегий</CardTitle></CardHeader>
                <TopYourStrategiesList items={topYourStrategies} />
              </Card>

              <Card>
                <CardHeader><CardTitle>ТОП стратегий в магазине</CardTitle></CardHeader>
                <TopStoreStrategiesList items={topStoreStrategies} />
              </Card>
            </div>
          </div>
        </div>
      </PageContent>
    </div>
  )
}
