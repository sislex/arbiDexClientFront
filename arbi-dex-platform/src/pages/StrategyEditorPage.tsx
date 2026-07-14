import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import { TradingRulesForm } from '../components/forms/TradingRulesForm'
import { createDefaultTradingRules } from '../data/tradingRulesDefaults'
import { getStrategyById, type StrategyData } from '../data/mockData'
import type { StrategyDraft } from '../types/tradingRules'
import { draftFromSearchParams, draftToSearchParams } from '../lib/strategyUrlParams'
import {
  getStrategyRulesForId,
  saveStrategyRulesForId,
} from '../lib/strategyRulesStorage'
import { loadStrategies, saveStrategies } from '../lib/strategiesStorage'
import { generateSelectionId } from '../types/chart'
import { cn, formatPercent } from '../lib/utils'

function createEmptyDraft(): StrategyDraft {
  return {
    name: '',
    description: '',
    rules: createDefaultTradingRules(),
  }
}

function strategyToDraft(strategy: StrategyData): StrategyDraft {
  return {
    name: strategy.name,
    description: strategy.description,
    rules: getStrategyRulesForId(strategy.id) ?? createDefaultTradingRules(),
  }
}

function draftToStrategy(draft: StrategyDraft, existing?: StrategyData): StrategyData {
  const base = existing ?? {
    id: generateSelectionId(),
    name: draft.name.trim(),
    description: draft.description.trim() || 'Пользовательская стратегия',
    type: 'Custom',
    timeframe: '15m',
    category: 'Custom',
    winRate: 0,
    roi: 0,
    drawdown: 0,
    profitFactor: 0,
    sharpe: 0,
    runningBots: 0,
    usageCount: 0,
    lastProfit: 0,
    status: 'active' as const,
    risk: 'medium' as const,
  }

  return {
    ...base,
    name: draft.name.trim(),
    description: draft.description.trim() || base.description,
  }
}

export function StrategyEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const existingStrategy = !isNew && id ? getStrategyById(id) : undefined

  const [draft, setDraft] = useState<StrategyDraft>(() => {
    const base = existingStrategy ? strategyToDraft(existingStrategy) : createEmptyDraft()
    return draftFromSearchParams(searchParams, base)
  })

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const base = isNew
      ? createEmptyDraft()
      : existingStrategy
        ? strategyToDraft(existingStrategy)
        : createEmptyDraft()
    setDraft(draftFromSearchParams(searchParams, base))
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when strategy id changes
  }, [id, isNew, existingStrategy?.id])

  const syncUrl = useCallback(
    (nextDraft: StrategyDraft) => {
      const params = draftToSearchParams(nextDraft)
      setSearchParams(params, { replace: true })
    },
    [setSearchParams],
  )

  const updateDraft = useCallback(
    (patch: Partial<StrategyDraft> | ((prev: StrategyDraft) => StrategyDraft)) => {
      setDraft((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
        syncUrl(next)
        setSaved(false)
        return next
      })
    },
    [syncUrl],
  )

  const canSave = draft.name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return

    const strategies = loadStrategies()
    const strategy = draftToStrategy(draft, existingStrategy)

    if (isNew) {
      saveStrategies([...strategies, strategy])
      saveStrategyRulesForId(strategy.id, draft.rules)
      navigate(`/strategies/${strategy.id}?${new URLSearchParams(draftToSearchParams(draft)).toString()}`, {
        replace: true,
      })
    } else if (existingStrategy) {
      const next = strategies.map((s) => (s.id === existingStrategy.id ? strategy : s))
      saveStrategies(next)
      saveStrategyRulesForId(existingStrategy.id, draft.rules)
      setSaved(true)
    }
  }

  const stats = existingStrategy

  const paramPreview = useMemo(() => {
    const enabled = draft.rules.filter((r) => r.enabled)
    return enabled.map((rule) => ({
      id: rule.id,
      params: Object.entries(rule.values)
        .map(([k, v]) => `${k}=${v}`)
        .join(', '),
    }))
  }, [draft.rules])

  if (!isNew && id && !existingStrategy) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted">Стратегия не найдена</p>
        <Link to="/strategies">
          <Button variant="outline">
            <ArrowLeft size={14} /> К списку стратегий
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={isNew ? 'Новая стратегия' : draft.name || 'Редактирование стратегии'}
        subtitle={
          isNew
            ? 'Создание стратегии с правилами торговли'
            : `ID: ${existingStrategy?.id ?? id}`
        }
        actions={
          <div className="flex items-center gap-2">
            <Link to="/strategies">
              <Button variant="outline">
                <ArrowLeft size={14} /> Назад
              </Button>
            </Link>
            <Button onClick={handleSave} disabled={!canSave}>
              <Save size={14} />
              {isNew ? 'Создать' : saved ? 'Сохранено' : 'Сохранить'}
            </Button>
          </div>
        }
      />

      <PageContent className="flex-1 min-h-0 overflow-y-auto space-y-5 max-w-5xl">
        {!isNew && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted">ROI</p>
              <p className={cn('text-lg font-bold', stats.roi >= 0 ? 'text-success' : 'text-error')}>
                {formatPercent(stats.roi)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Win Rate</p>
              <p className="text-lg font-bold text-white">{stats.winRate}%</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Drawdown</p>
              <p className="text-lg font-bold text-warning">{stats.drawdown}%</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Status</p>
              <div className="mt-1">
                <StatusBadge status={stats.status} />
              </div>
            </Card>
          </div>
        )}

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Основное</h2>
          <div>
            <label className="text-sm text-muted block mb-1.5">Название</label>
            <input
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50"
              placeholder="My Strategy"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1.5">Описание</label>
            <textarea
              value={draft.description}
              onChange={(e) => updateDraft({ description: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50 h-28 resize-none"
              placeholder="Опишите логику стратегии..."
            />
          </div>
        </Card>

        <Card className="p-5">
          <TradingRulesForm
            rules={draft.rules}
            onChange={(rules) => updateDraft({ rules })}
          />
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Параметры в URL</h2>
          <p className="text-xs text-muted">
            Параметры стратегии синхронизируются с адресной строкой — ссылку можно сохранить или отправить.
          </p>
          <div className="rounded-xl bg-surface border border-border p-3 font-mono text-xs text-muted break-all">
            /strategies/{isNew ? 'new' : existingStrategy?.id}
            {searchParams.toString() ? `?${searchParams.toString()}` : ''}
          </div>
          {paramPreview.length > 0 && (
            <div className="space-y-2">
              {paramPreview.map((item) => (
                <div key={item.id} className="flex gap-2 text-xs">
                  <span className="text-accent-purple font-mono shrink-0">{item.id}</span>
                  <span className="text-muted">{item.params || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </PageContent>
    </div>
  )
}
