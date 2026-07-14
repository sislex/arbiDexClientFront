import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Edit2, Trash2, Plus, Clock } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import { SortableTableHead } from '../components/ui/SortableTableHead'
import { SearchInput, Select } from '../components/ui/SearchInput'
import { type Bot } from '../data/mockData'
import { loadBots } from '../lib/botsStorage'
import { useTableSort } from '../hooks/useTableSort'
import { useUndoDelete } from '../context/UndoDeleteContext'
import { cn, formatCurrency, formatPercent } from '../lib/utils'

type BotSortKey = 'name' | 'pair' | 'strategy' | 'roi' | 'winRate' | 'drawdown' | 'status'

function getBotSortValue(bot: Bot, key: BotSortKey) {
  switch (key) {
    case 'name':
      return bot.name
    case 'pair':
      return bot.pair
    case 'strategy':
      return bot.strategy
    case 'roi':
      return bot.roi
    case 'winRate':
      return bot.winRate
    case 'drawdown':
      return bot.drawdown
    case 'status':
      return bot.status
  }
}

export function BotsPage() {
  const navigate = useNavigate()
  const [bots, setBots] = useState<Bot[]>(() => loadBots())
  const [statusTab, setStatusTab] = useState('all')
  const [pairTab, setPairTab] = useState('all')
  const [search, setSearch] = useState('')
  const { sortKey, direction, toggleSort, sort } = useTableSort<BotSortKey>()
  const { scheduleDelete, isEntityPending, deleteRevision, pendingKeys } = useUndoDelete()

  useEffect(() => {
    setBots(loadBots())
  }, [deleteRevision])

  const pairOptions = useMemo(() => {
    const symbols = [...new Set(bots.map((b) => b.pair))].sort((a, b) => a.localeCompare(b))
    return [
      { value: 'all', label: `Все пары (${bots.length})` },
      ...symbols.map((pair) => ({
        value: pair,
        label: `${pair} (${bots.filter((b) => b.pair === pair).length})`,
      })),
    ]
  }, [bots])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: `Все (${bots.length})` },
      { value: 'active', label: `Активные (${bots.filter((b) => b.status === 'active').length})` },
      { value: 'paused', label: `Пауза (${bots.filter((b) => b.status === 'paused').length})` },
      { value: 'stopped', label: `Остановлены (${bots.filter((b) => b.status === 'stopped').length})` },
    ],
    [bots],
  )

  const filtered = useMemo(
    () =>
      sort(
        bots.filter((b) => {
          if (isEntityPending('bot', b.id)) return false
          if (pairTab !== 'all' && b.pair !== pairTab) return false
          if (statusTab !== 'all' && b.status !== statusTab) return false
          if (search && !b.name.toLowerCase().includes(search.toLowerCase()) && !b.strategy.toLowerCase().includes(search.toLowerCase())) {
            return false
          }
          return true
        }),
        getBotSortValue,
      ),
    [bots, pairTab, statusTab, search, sort, pendingKeys, isEntityPending],
  )

  const handleDeleteBot = (bot: Bot, e: React.MouseEvent) => {
    e.stopPropagation()
    scheduleDelete({
      entityType: 'bot',
      entityId: bot.id,
      message: `Бот «${bot.name}» будет удалён`,
    })
  }

  return (
    <>
      <PageHeader
        title="Bots"
        subtitle="Управление торговыми ботами"
        actions={
          <Button onClick={() => navigate('/bots/new')}>
            <Plus size={16} /> Добавить бота
          </Button>
        }
      />
      <PageContent className="space-y-5">
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            className="flex-1 min-w-0"
            placeholder="Поиск ботов..."
          />
          <Select
            value={statusTab}
            onChange={setStatusTab}
            className="w-44 shrink-0"
            options={statusOptions}
          />
          <Select
            value={pairTab}
            onChange={setPairTab}
            className="w-44 shrink-0"
            options={pairOptions}
          />
        </div>

        {filtered.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-muted text-left border-b border-border">
                    <SortableTableHead label="Name" column="name" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className="px-5 py-3" />
                    <SortableTableHead label="Pair" column="pair" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className="px-5 py-3" />
                    <SortableTableHead label="Strategy" column="strategy" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className="px-5 py-3" />
                    <SortableTableHead label="ROI" column="roi" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className="px-5 py-3" align="right" />
                    <SortableTableHead label="Win Rate" column="winRate" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className="px-5 py-3" align="right" />
                    <SortableTableHead label="Drawdown" column="drawdown" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className="px-5 py-3" align="right" />
                    <SortableTableHead label="Status" column="status" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className="px-5 py-3" />
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bot) => (
                    <tr
                      key={bot.id}
                      onClick={() => navigate(`/bots/${bot.id}?mode=demo&trade=auto`)}
                      className="border-b border-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-white">{bot.name}</p>
                        <p className="text-xs text-muted mt-0.5">{formatCurrency(bot.balance)} · {bot.runtime}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{bot.pair}</td>
                      <td className="px-5 py-3.5 text-muted">{bot.strategy}</td>
                      <td className={cn('px-5 py-3.5 text-right font-medium', bot.roi >= 0 ? 'text-success' : 'text-error')}>
                        {formatPercent(bot.roi)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-white">{bot.winRate}%</td>
                      <td className="px-5 py-3.5 text-right text-warning">{bot.drawdown}%</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={bot.status} />
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          <Link
                            to={`/bots/${bot.id}/history`}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-accent-cyan"
                            title="Исторические данные"
                          >
                            <Clock size={14} />
                          </Link>
                          <Link
                            to={`/bots/${bot.id}/edit`}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-white"
                            title="Редактировать"
                          >
                            <Edit2 size={14} />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteBot(bot, e)}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-error"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <p className="text-muted">
              {pairTab === 'all' ? 'Нет ботов по выбранным фильтрам' : `Нет ботов для ${pairTab}`}
            </p>
            <Button className="mt-4" onClick={() => navigate('/bots/new')}>
              <Plus size={16} /> Добавить бота
            </Button>
          </Card>
        )}
      </PageContent>
    </>
  )
}
