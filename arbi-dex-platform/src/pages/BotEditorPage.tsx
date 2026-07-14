import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import { Select } from '../components/ui/SearchInput'
import {
  getBotById,
  getStrategies,
  getTradingPairById,
  type Bot,
} from '../data/mockData'
import { loadTradingPairs } from '../lib/tradingPairsStorage'
import { loadBots, saveBots } from '../lib/botsStorage'
import {
  botDraftFromSearchParams,
  botDraftToSearchParams,
  botToDraft,
  DEFAULT_BOT_LAUNCH,
  type BotDraft,
} from '../lib/botUrlParams'
import { generateSelectionId } from '../types/chart'
import { cn, formatCurrency, formatPercent } from '../lib/utils'

const PROFIT_CURRENCIES = [
  { value: 'USDT', label: 'USDT' },
  { value: 'USDC', label: 'USDC' },
  { value: 'USD', label: 'USD' },
  { value: 'BTC', label: 'BTC' },
  { value: 'ETH', label: 'ETH' },
]

function createEmptyDraft(): BotDraft {
  const sets = loadTradingPairs().filter((p) => p.purpose !== 'monitoring')
  const first = sets[0]
  return {
    name: first ? `${first.name} Bot` : 'Bot',
    pairSetId: first?.id ?? '',
    pair: first?.pair ?? 'BTC/USDT',
    strategyIds: [],
    launch: { ...DEFAULT_BOT_LAUNCH },
    status: 'active',
  }
}

function resolveBotName(baseName: string, pair: string, strategyName: string, multiple: boolean): string {
  const trimmed = baseName.trim()
  if (!trimmed) return `${pair.split('/')[0]} ${strategyName}`
  if (multiple) return `${trimmed} — ${strategyName}`
  return trimmed
}

export function BotEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const existingBot = !isNew && id ? getBotById(id) : undefined
  const strategies = getStrategies()
  const tradingPairSets = useMemo(
    () => loadTradingPairs().filter((p) => p.purpose !== 'monitoring'),
    [id],
  )

  const [draft, setDraft] = useState<BotDraft>(() => {
    const base = existingBot ? botToDraft(existingBot) : createEmptyDraft()
    return botDraftFromSearchParams(searchParams, base)
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const base = isNew ? createEmptyDraft() : existingBot ? botToDraft(existingBot) : createEmptyDraft()
    setDraft(botDraftFromSearchParams(searchParams, base))
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, existingBot?.id])

  const syncUrl = useCallback(
    (next: BotDraft) => {
      setSearchParams(botDraftToSearchParams(next), { replace: true })
    },
    [setSearchParams],
  )

  const updateDraft = useCallback(
    (patch: Partial<BotDraft> | ((prev: BotDraft) => BotDraft)) => {
      setDraft((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
        syncUrl(next)
        setSaved(false)
        return next
      })
    },
    [syncUrl],
  )

  const selectedPairSet = getTradingPairById(draft.pairSetId)
  const startingBudget = Number(draft.launch.startingBudget)
  const maxTurnover = Number(draft.launch.maxTurnover)
  const minStopBudget = Number(draft.launch.minStopBudget)
  const peakStopPercent = Number(draft.launch.peakStopPercent)

  const launchValid =
    startingBudget > 0 &&
    maxTurnover >= startingBudget &&
    minStopBudget > 0 &&
    minStopBudget < startingBudget &&
    peakStopPercent > 0 &&
    peakStopPercent <= 100

  const canSave =
    draft.name.trim().length > 0 &&
    draft.pairSetId.length > 0 &&
    draft.strategyIds.length > 0 &&
    launchValid

  const toggleStrategy = (strategyId: string) => {
    updateDraft((prev) => ({
      ...prev,
      strategyIds: prev.strategyIds.includes(strategyId)
        ? prev.strategyIds.filter((s) => s !== strategyId)
        : [...prev.strategyIds, strategyId],
    }))
  }

  const handleSave = () => {
    if (!canSave) return

    if (isNew) {
      const selectedItems = strategies.filter((s) => draft.strategyIds.includes(s.id))
      const multiple = selectedItems.length > 1
      const newBots: Bot[] = selectedItems.map((s) => ({
        id: generateSelectionId(),
        name: resolveBotName(draft.name, draft.pair, s.name, multiple),
        pair: draft.pair,
        pairSetId: draft.pairSetId,
        strategy: s.name,
        strategyId: s.id,
        balance: startingBudget,
        roi: 0,
        profit: 0,
        winRate: 0,
        drawdown: 0,
        trades: 0,
        lastTrade: '—',
        runtime: '0d',
        status: draft.status,
        startingBudget,
        maxTurnover,
        minStopBudget,
        peakStopPercent,
        profitCurrency: draft.launch.profitCurrency,
      }))
      const all = [...loadBots(), ...newBots]
      saveBots(all)
      const first = newBots[0]
      if (first && newBots.length === 1) {
        navigate(`/bots/${first.id}/edit?${new URLSearchParams(botDraftToSearchParams(botToDraft(first))).toString()}`, {
          replace: true,
        })
      } else {
        navigate('/bots')
      }
      return
    }

    if (!existingBot) return
    const strategy = strategies.find((s) => s.id === draft.strategyIds[0])
    const updated: Bot = {
      ...existingBot,
      name: draft.name.trim(),
      pair: draft.pair,
      pairSetId: draft.pairSetId,
      strategy: strategy?.name ?? existingBot.strategy,
      strategyId: draft.strategyIds[0] ?? existingBot.strategyId,
      status: draft.status,
      startingBudget,
      maxTurnover,
      minStopBudget,
      peakStopPercent,
      profitCurrency: draft.launch.profitCurrency,
    }
    saveBots(loadBots().map((b) => (b.id === existingBot.id ? updated : b)))
    setSaved(true)
  }

  if (!isNew && id && !existingBot) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted">Бот не найден</p>
        <Link to="/bots">
          <Button variant="outline">
            <ArrowLeft size={14} /> К списку ботов
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={isNew ? 'Новый бот' : draft.name || 'Редактирование бота'}
        subtitle={isNew ? 'Создание бота' : `ID: ${existingBot?.id ?? id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/bots">
              <Button variant="outline">
                <ArrowLeft size={14} /> Назад
              </Button>
            </Link>
            {!isNew && existingBot && (
              <Link to={`/bots/${existingBot.id}?mode=demo&trade=auto`}>
                <Button variant="outline">Открыть бота</Button>
              </Link>
            )}
            <Button onClick={handleSave} disabled={!canSave}>
              <Save size={14} />
              {isNew ? 'Создать' : saved ? 'Сохранено' : 'Сохранить'}
            </Button>
          </div>
        }
      />

      <PageContent className="flex-1 min-h-0 overflow-y-auto space-y-5 max-w-4xl">
        {!isNew && existingBot && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted">ROI</p>
              <p className={cn('text-lg font-bold', existingBot.roi >= 0 ? 'text-success' : 'text-error')}>
                {formatPercent(existingBot.roi)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Баланс</p>
              <p className="text-lg font-bold text-white">{formatCurrency(existingBot.balance)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Win Rate</p>
              <p className="text-lg font-bold text-white">{existingBot.winRate}%</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Status</p>
              <div className="mt-1"><StatusBadge status={existingBot.status} /></div>
            </Card>
          </div>
        )}

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Набор пар</h2>
          {tradingPairSets.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted">Нет торговых наборов</p>
              <Link to="/pairs/new" className="inline-block mt-3">
                <Button variant="outline" size="sm">Создать набор</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tradingPairSets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  onClick={() =>
                    updateDraft({
                      pairSetId: set.id,
                      pair: set.pair,
                      name:
                        draft.name.trim() === '' || draft.name.endsWith(' Bot')
                          ? `${set.name} Bot`
                          : draft.name,
                    })
                  }
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    draft.pairSetId === set.id
                      ? 'border-accent-purple bg-accent-purple/10'
                      : 'border-border bg-surface hover:border-white/10',
                  )}
                >
                  <p className="font-semibold text-white">{set.name}</p>
                  <p className="text-sm text-accent-purple">{set.pair}</p>
                  <p className="text-xs text-muted mt-1">{set.exchanges.join(', ')}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Основное</h2>
          <div>
            <label className="text-sm text-muted block mb-1.5">Название</label>
            <input
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50"
            />
          </div>
          {!isNew && (
            <div>
              <label className="text-sm text-muted block mb-1.5">Статус</label>
              <Select
                value={draft.status}
                onChange={(value) => updateDraft({ status: value as Bot['status'] })}
                options={[
                  { value: 'active', label: 'Активен' },
                  { value: 'paused', label: 'Пауза' },
                  { value: 'stopped', label: 'Остановлен' },
                ]}
                className="w-full"
              />
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Стратегии</h2>
          <p className="text-xs text-muted">
            {isNew
              ? 'Можно выбрать несколько — для каждой будет создан отдельный бот'
              : 'Одна стратегия на бота'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {strategies.map((s) => {
              const selected = draft.strategyIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (isNew) {
                      toggleStrategy(s.id)
                    } else {
                      updateDraft({ strategyIds: [s.id] })
                    }
                  }}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    selected ? 'border-accent-purple bg-accent-purple/10' : 'border-border bg-surface',
                  )}
                >
                  <p className="font-semibold text-white">{s.name}</p>
                  <p className="text-xs text-muted line-clamp-2 mt-1">{s.description}</p>
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Параметры запуска</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted block mb-1.5">Стартовый бюджет</label>
              <input
                type="number"
                min={1}
                value={draft.launch.startingBudget}
                onChange={(e) =>
                  updateDraft({ launch: { ...draft.launch, startingBudget: e.target.value } })
                }
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1.5">Макс. в обороте</label>
              <input
                type="number"
                min={1}
                value={draft.launch.maxTurnover}
                onChange={(e) =>
                  updateDraft({ launch: { ...draft.launch, maxTurnover: e.target.value } })
                }
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1.5">Мин. для остановки</label>
              <input
                type="number"
                min={1}
                value={draft.launch.minStopBudget}
                onChange={(e) =>
                  updateDraft({ launch: { ...draft.launch, minStopBudget: e.target.value } })
                }
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1.5">Стоп от пика, %</label>
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={draft.launch.peakStopPercent}
                onChange={(e) =>
                  updateDraft({ launch: { ...draft.launch, peakStopPercent: e.target.value } })
                }
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-muted block mb-1.5">Валюта прибыли</label>
              <Select
                value={draft.launch.profitCurrency}
                onChange={(value) =>
                  updateDraft({ launch: { ...draft.launch, profitCurrency: value } })
                }
                options={PROFIT_CURRENCIES}
                className="w-full"
              />
            </div>
          </div>
          {!launchValid && (
            <p className="text-xs text-warning">Проверьте параметры запуска</p>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Параметры в URL</h2>
          <div className="rounded-xl bg-surface border border-border p-3 font-mono text-xs text-muted break-all">
            /bots/{isNew ? 'new' : `${existingBot?.id}/edit`}
            {searchParams.toString() ? `?${searchParams.toString()}` : ''}
          </div>
          {selectedPairSet && (
            <p className="text-xs text-muted">
              Набор: {selectedPairSet.name} · {selectedPairSet.pair}
            </p>
          )}
        </Card>
      </PageContent>
    </div>
  )
}
