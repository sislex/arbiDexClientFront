import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Edit2, Loader2, Pause, Play, Plus, Clock, Square, Trash2 } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
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
import { SearchInput, Select } from '../components/ui/SearchInput'
import { type Bot } from '../data/mockData'
import { loadBots, saveBots } from '../lib/botsStorage'
import { useTableSort } from '../hooks/useTableSort'
import { useUndoDelete } from '../context/UndoDeleteContext'
import { useAuth } from '../context/AuthContext'
import { cn, formatCurrency, formatPercent } from '../lib/utils'
import {
  fetchServerBots,
  updateServerBot,
  type ServerBotMode,
  type ServerBotStatus,
  type ServerBotUpdatePayload,
} from '../services/botsApi'

type BotSortKey = 'name' | 'pair' | 'strategy' | 'roi' | 'winRate' | 'drawdown' | 'status'
type SessionUiStatus = Bot['status']

const BOTS_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultPercent: 18, minPercent: 12 },
  { id: 'pair', defaultPercent: 9, minPercent: 7 },
  { id: 'strategy', defaultPercent: 12, minPercent: 9 },
  { id: 'roi', defaultPercent: 8, minPercent: 6 },
  { id: 'winRate', defaultPercent: 9, minPercent: 7 },
  { id: 'drawdown', defaultPercent: 9, minPercent: 7 },
  { id: 'status', defaultPercent: 11, minPercent: 9 },
  { id: 'actions', defaultPercent: 20, minPercent: 16 },
]

function mapServerStatusToUi(status: ServerBotStatus): SessionUiStatus {
  if (status === 'running') return 'active'
  if (status === 'paused') return 'paused'
  return 'stopped'
}

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
  const { isAuthenticated } = useAuth()
  const [bots, setBots] = useState<Bot[]>(() => loadBots())
  const [statusTab, setStatusTab] = useState('all')
  const [pairTab, setPairTab] = useState('all')
  const [search, setSearch] = useState('')
  const [serverModes, setServerModes] = useState<Record<string, ServerBotMode>>({})
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const { sortKey, direction, toggleSort, sort } = useTableSort<BotSortKey>()
  const { scheduleDelete, isEntityPending, deleteRevision, pendingKeys } = useUndoDelete()

  const applyServerStatuses = useCallback((serverBots: Awaited<ReturnType<typeof fetchServerBots>>) => {
    const byId = new Map(serverBots.map((b) => [b.id, b]))
    const modes: Record<string, ServerBotMode> = {}
    for (const sb of serverBots) modes[sb.id] = sb.mode
    setServerModes(modes)

    const next = loadBots().map((bot) => {
      if (!bot.serverBotId) return bot
      const sb = byId.get(bot.serverBotId)
      if (!sb) return bot
      return { ...bot, status: mapServerStatusToUi(sb.status) }
    })
    saveBots(next)
    setBots(next)
  }, [])

  useEffect(() => {
    setBots(loadBots())
  }, [deleteRevision])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    fetchServerBots()
      .then((serverBots) => {
        if (!cancelled) applyServerStatuses(serverBots)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, deleteRevision, applyServerStatuses])

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

  const statusOptions = useMemo(() => {
    return [
      { value: 'all', label: `Все (${bots.length})` },
      { value: 'active', label: `Активные (${bots.filter((b) => b.status === 'active').length})` },
      { value: 'paused', label: `Пауза (${bots.filter((b) => b.status === 'paused').length})` },
      { value: 'stopped', label: `Остановлены (${bots.filter((b) => b.status === 'stopped').length})` },
    ]
  }, [bots])

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

  const patchSessionStatus = async (bot: Bot, nextStatus: 'running' | 'paused' | 'stopped') => {
    if (!bot.serverBotId) return
    setStatusUpdatingId(bot.id)
    setStatusError(null)
    try {
      const payload: ServerBotUpdatePayload = { status: nextStatus }
      if (nextStatus === 'running' && bot.status !== 'paused') {
        const mode = serverModes[bot.serverBotId]
        payload.mode = mode === 'real-live' ? 'real-live' : 'demo-live'
      }
      const updated = await updateServerBot(bot.serverBotId, payload)
      setServerModes((prev) => ({ ...prev, [updated.id]: updated.mode }))
      const uiStatus = mapServerStatusToUi(updated.status)
      const nextBots = loadBots().map((b) => (b.id === bot.id ? { ...b, status: uiStatus } : b))
      saveBots(nextBots)
      setBots(nextBots)
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Не удалось обновить статус сессии')
    } finally {
      setStatusUpdatingId(null)
    }
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
        {!isAuthenticated && (
          <Card className="px-4 py-3 text-sm text-muted">
            Войдите через кошелёк, чтобы новые боты сохранялись на сервер и был доступен бэктест.{' '}
            <Link to="/login" className="text-accent-cyan hover:underline">Войти</Link>
          </Card>
        )}
        {statusError && (
          <Card className="px-4 py-3 text-sm text-error border-error/20">
            {statusError}
          </Card>
        )}
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
            <div className="overflow-x-hidden">
              <ResizableTable tableId="bots" columns={BOTS_TABLE_COLUMNS} className="text-xs">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-muted text-left border-b border-border">
                    <SortableTableHead label="Name" column="name" columnId="name" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className={TABLE_HEAD} />
                    <SortableTableHead label="Pair" column="pair" columnId="pair" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className={TABLE_HEAD} />
                    <SortableTableHead label="Strategy" column="strategy" columnId="strategy" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className={TABLE_HEAD} />
                    <SortableTableHead label="ROI" column="roi" columnId="roi" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className={TABLE_HEAD} align="right" />
                    <SortableTableHead label="Win Rate" column="winRate" columnId="winRate" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className={TABLE_HEAD} align="right" />
                    <SortableTableHead label="Drawdown" column="drawdown" columnId="drawdown" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className={TABLE_HEAD} align="right" />
                    <SortableTableHead label="Сессия" column="status" columnId="status" sortKey={sortKey} direction={direction} onSort={(col) => toggleSort(col as BotSortKey)} className={TABLE_HEAD} />
                    <TableHeadCell columnId="actions" className={TABLE_HEAD} align="center">Actions</TableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bot) => {
                    const sessionBusy = statusUpdatingId === bot.id
                    const canControlSession = Boolean(isAuthenticated && bot.serverBotId)
                    return (
                      <tr
                        key={bot.id}
                        onClick={() => navigate(`/bots/${bot.id}?mode=demo&trade=auto`)}
                        className="border-b border-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <td className={TABLE_CELL}>
                          <p className="font-semibold text-white truncate">{bot.name}</p>
                          <p className="text-[11px] text-muted mt-0.5 truncate">
                            {formatCurrency(bot.balance)} · {bot.runtime}
                            {isAuthenticated && bot.serverBotId ? ' · на сервере' : ''}
                            {isAuthenticated && !bot.serverBotId ? ' · не синхронизирован' : ''}
                          </p>
                        </td>
                        <td className={cn(TABLE_CELL, 'text-muted truncate')}>{bot.pair}</td>
                        <td className={cn(TABLE_CELL, 'text-muted truncate')}>{bot.strategy}</td>
                        <td className={cn(TABLE_CELL, 'text-right font-medium', bot.roi >= 0 ? 'text-success' : 'text-error')}>
                          {formatPercent(bot.roi)}
                        </td>
                        <td className={cn(TABLE_CELL, 'text-right text-white')}>{bot.winRate}%</td>
                        <td className={cn(TABLE_CELL, 'text-right text-warning')}>{bot.drawdown}%</td>
                        <td className={TABLE_CELL}>
                          <StatusBadge status={bot.status} />
                        </td>
                        <td className={TABLE_ACTIONS_CELL} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-0.5">
                            {canControlSession && (
                              <>
                                <button
                                  type="button"
                                  disabled={sessionBusy || bot.status === 'active'}
                                  onClick={() => void patchSessionStatus(bot, 'running')}
                                  className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-success disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                  title="Старт"
                                  data-testid={`bot-start-${bot.id}`}
                                >
                                  {sessionBusy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                                </button>
                                <button
                                  type="button"
                                  disabled={sessionBusy || bot.status !== 'active'}
                                  onClick={() => void patchSessionStatus(bot, 'paused')}
                                  className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-warning disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                  title="Пауза"
                                  data-testid={`bot-pause-${bot.id}`}
                                >
                                  <Pause size={13} />
                                </button>
                                <button
                                  type="button"
                                  disabled={sessionBusy || bot.status === 'stopped'}
                                  onClick={() => void patchSessionStatus(bot, 'stopped')}
                                  className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-error disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                  title="Стоп"
                                  data-testid={`bot-stop-${bot.id}`}
                                >
                                  <Square size={13} />
                                </button>
                              </>
                            )}
                            <Link
                              to={`/bots/${bot.id}/history`}
                              className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-accent-cyan shrink-0"
                              title="Исторические данные"
                            >
                              <Clock size={13} />
                            </Link>
                            <Link
                              to={`/bots/${bot.id}/edit`}
                              className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-white shrink-0"
                              title="Редактировать"
                            >
                              <Edit2 size={13} />
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteBot(bot, e)}
                              className="p-1 rounded-md hover:bg-white/5 text-muted hover:text-error shrink-0"
                              title="Удалить"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </ResizableTable>
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
