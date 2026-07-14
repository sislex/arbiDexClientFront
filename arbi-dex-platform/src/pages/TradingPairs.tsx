import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Edit2, Trash2, Plus, LineChart } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { SearchInput } from '../components/ui/SearchInput'
import { ExchangeViewDropdown } from '../components/ui/ExchangeViewDropdown'
import { SortableTableHead } from '../components/ui/SortableTableHead'
import { getBots, isMonitoringPair, type TradingPair } from '../data/mockData'
import { loadTradingPairs } from '../lib/tradingPairsStorage'
import { buildPairBotCountMap } from '../lib/botCounts'
import { useTableSort } from '../hooks/useTableSort'
import { useUndoDelete } from '../context/UndoDeleteContext'
import { cn } from '../lib/utils'

type PairSortKey = 'name' | 'pair' | 'type' | 'exchange' | 'runningBots' | 'created'

function getPairSortValue(pair: TradingPair, key: PairSortKey, botCounts: Map<string, number>) {
  switch (key) {
    case 'name':
      return pair.name
    case 'pair':
      return pair.pair
    case 'type':
      return isMonitoringPair(pair) ? 'monitoring' : 'trading'
    case 'exchange':
      return pair.exchanges.join(', ')
    case 'runningBots':
      return botCounts.get(pair.id) ?? 0
    case 'created':
      return pair.created
  }
}

export function TradingPairsPage() {
  const navigate = useNavigate()
  const [pairs, setPairs] = useState<TradingPair[]>(() => loadTradingPairs())
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<TradingPair | null>(() => loadTradingPairs()[0] ?? null)
  const { sortKey, direction, toggleSort, sort } = useTableSort<PairSortKey>()
  const { scheduleDelete, isEntityPending, deleteRevision, pendingKeys } = useUndoDelete()

  useEffect(() => {
    const next = loadTradingPairs()
    setPairs(next)
    setSelected((sel) => {
      if (sel && next.some((pair) => pair.id === sel.id) && !isEntityPending('pair', sel.id)) {
        return sel
      }
      return next.find((pair) => !isEntityPending('pair', pair.id)) ?? null
    })
  }, [deleteRevision, isEntityPending])

  useEffect(() => {
    setSelected((sel) => {
      if (sel && !isEntityPending('pair', sel.id)) return sel
      return pairs.find((pair) => !isEntityPending('pair', pair.id)) ?? null
    })
  }, [pairs, pendingKeys, isEntityPending])

  const bots = useMemo(() => getBots(), [deleteRevision])

  const pairBotCounts = useMemo(
    () => buildPairBotCountMap(bots, pairs),
    [bots, pairs],
  )

  const filtered = useMemo(
    () =>
      sort(
        pairs.filter((p) => {
          if (isEntityPending('pair', p.id)) return false
          const q = search.toLowerCase()
          if (q && !p.name.toLowerCase().includes(q) && !p.pair.toLowerCase().includes(q)) return false
          return true
        }),
        (pair, key) => getPairSortValue(pair, key, pairBotCounts),
      ),
    [pairs, search, sort, pendingKeys, isEntityPending, pairBotCounts],
  )

  const selectedBotCount = selected ? pairBotCounts.get(selected.id) ?? 0 : 0

  const handleDeletePair = (pair: TradingPair, e: React.MouseEvent) => {
    e.stopPropagation()
    scheduleDelete({
      entityType: 'pair',
      entityId: pair.id,
      message: `Пара «${pair.name}» будет удалена`,
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Trading Pairs"
        subtitle="Библиотека торговых пар"
        actions={
          <Button onClick={() => navigate('/pairs/new')}>
            <Plus size={16} /> Добавить пару
          </Button>
        }
      />
      <PageContent className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-1 flex-col min-h-0 min-w-0 gap-5">
          <div className="flex items-center gap-3 shrink-0">
            <SearchInput
              value={search}
              onChange={setSearch}
              className="flex-1 min-w-0"
              placeholder="Поиск по имени или паре..."
            />
          </div>

          <div className="flex flex-1 min-h-0 min-w-0 gap-4">
            <Card className="flex-[7] min-w-0 flex flex-col min-h-0 overflow-hidden p-0">
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                <table className="w-full text-xs table-fixed">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="text-muted text-left border-b border-border">
                      <SortableTableHead label="Name" column="name" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as PairSortKey)} className="w-[24%] px-3 py-2.5" />
                      <SortableTableHead label="Pair" column="pair" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as PairSortKey)} className="w-[11%] px-3 py-2.5" />
                      <SortableTableHead label="Type" column="type" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as PairSortKey)} className="w-[10%] px-3 py-2.5" />
                      <SortableTableHead label="Exchange" column="exchange" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as PairSortKey)} className="w-[17%] px-3 py-2.5" />
                      <SortableTableHead label="Bots" column="runningBots" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as PairSortKey)} className="w-[7%] px-2 py-2.5" align="center" />
                      <SortableTableHead label="Created" column="created" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as PairSortKey)} className="w-[12%] px-3 py-2.5" />
                      <th className="w-[9%] px-2 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((pair) => (
                      <tr
                        key={pair.id}
                        onClick={() => {
                          setSelected(pair)
                          navigate(`/pairs/${pair.id}`)
                        }}
                        className={cn(
                          'border-b border-border/50 cursor-pointer transition-colors',
                          selected?.id === pair.id ? 'bg-accent-purple/5' : 'hover:bg-white/[0.02]',
                        )}
                      >
                        <td className="px-3 py-2.5 font-semibold text-white truncate" title={pair.name}>
                          {pair.name}
                        </td>
                        <td className="px-3 py-2.5 text-muted truncate">{pair.pair}</td>
                        <td className="px-3 py-2.5">
                          {isMonitoringPair(pair) ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent-cyan/15 text-accent-cyan whitespace-nowrap">
                              Монит.
                            </span>
                          ) : (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent-purple/15 text-accent-purple whitespace-nowrap">
                              Торг.
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <ExchangeViewDropdown
                            exchanges={pair.exchanges}
                            tradingExchange={pair.tradingExchange}
                            monitoring={isMonitoringPair(pair)}
                            compact
                          />
                        </td>
                        <td className="px-2 py-2.5 text-center text-white">{pairBotCounts.get(pair.id) ?? 0}</td>
                        <td className="px-3 py-2.5 text-muted whitespace-nowrap">{pair.created}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex gap-0.5">
                            <Link
                              to={`/chart/${pair.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-accent-cyan"
                              title="График отслеживания"
                            >
                              <LineChart size={13} />
                            </Link>
                            <Link
                              to={`/pairs/${pair.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-white"
                              title="Редактировать"
                            >
                              <Edit2 size={13} />
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => handleDeletePair(pair, e)}
                              className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-error"
                              title="Удалить"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="flex-[3] min-w-0 flex flex-col gap-4 overflow-y-auto min-h-0">
              {selected && !isEntityPending('pair', selected.id) ? (
                <>
                  <Card>
                    <div className="space-y-4">
                      <div>
                        <p className="text-2xl font-bold text-white">{selected.name}</p>
                        <p className="text-sm text-muted mt-1">
                          {selected.pair}
                          {isMonitoringPair(selected)
                            ? ' · Только мониторинг'
                            : ` · Торговая биржа: ${selected.tradingExchange}`}
                        </p>
                        <p className="text-[10px] text-muted font-mono mt-1">ID: {selected.id}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-surface">
                        <p className="text-xs text-muted">
                          {isMonitoringPair(selected) ? 'Назначение' : 'Bots'}
                        </p>
                        <p className="text-lg font-bold text-white">
                          {isMonitoringPair(selected) ? 'Мониторинг' : selectedBotCount}
                        </p>
                      </div>
                      <Link to={`/pairs/${selected.id}`}>
                        <Button variant="outline" className="w-full">Редактировать</Button>
                      </Link>
                      <Link to={`/chart/${selected.id}`}>
                        <Button className="w-full">
                          <LineChart size={16} /> График отслеживания
                        </Button>
                      </Link>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Connected Exchanges</CardTitle></CardHeader>
                    <div className="space-y-2">
                      {selected.exchanges.map((ex) => (
                        <div key={ex} className="flex items-center justify-between p-2.5 rounded-xl bg-surface">
                          <span className="text-sm text-white truncate">
                            {ex}
                            {!isMonitoringPair(selected) && ex === selected.tradingExchange && (
                              <span className="ml-2 text-[10px] text-accent-purple uppercase">Trade</span>
                            )}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted text-center px-4">Выберите пару в таблице</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </PageContent>
    </div>
  )
}
