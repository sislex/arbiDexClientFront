import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import { Select } from '../components/ui/SearchInput'
import {
  fetchServerBot,
  updateServerBot,
  type ServerBot,
  type ServerBotMode,
  type ServerBotStatus,
} from '../services/botsApi'
import { fetchMarketConfigs, fetchStrategyConfigs } from '../services/configApi'
import { cn, formatCurrency, formatPercent } from '../lib/utils'

interface ServerBotEditorPageProps {
  botId: string
}

export function ServerBotEditorPage({ botId }: ServerBotEditorPageProps) {
  const navigate = useNavigate()
  const [bot, setBot] = useState<ServerBot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [mode, setMode] = useState<ServerBotMode>('demo-live')
  const [status, setStatus] = useState<ServerBotStatus>('stopped')
  const [initialBalance, setInitialBalance] = useState(1000)
  const [quoteAsset, setQuoteAsset] = useState('')
  const [slippagePct, setSlippagePct] = useState(0.5)
  const [marketConfigId, setMarketConfigId] = useState('')
  const [strategyConfigId, setStrategyConfigId] = useState('')

  const [marketConfigs, setMarketConfigs] = useState<Array<{ id: string; name: string }>>([])
  const [strategyConfigs, setStrategyConfigs] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchServerBot(botId), fetchMarketConfigs(), fetchStrategyConfigs()])
      .then(([loaded, markets, strategies]) => {
        if (cancelled) return
        setBot(loaded)
        setName(loaded.name)
        setMode(loaded.mode as ServerBotMode)
        setStatus(loaded.status as ServerBotStatus)
        setInitialBalance(loaded.initialBalance)
        setQuoteAsset(loaded.quoteAsset)
        setSlippagePct(loaded.slippagePct ?? 0.5)
        setMarketConfigId(loaded.marketConfigId)
        setStrategyConfigId(loaded.strategyConfigId)
        setMarketConfigs(markets)
        setStrategyConfigs(strategies)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить бота')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [botId])

  const assetOptions = useMemo(() => {
    if (!bot) return [] as string[]
    return [...new Set([bot.baseAsset, bot.quoteAsset])]
  }, [bot])

  const effectiveQuoteAsset = assetOptions.includes(quoteAsset) ? quoteAsset : assetOptions[0] ?? quoteAsset

  const isDirty = bot
    ? name.trim() !== bot.name ||
      mode !== bot.mode ||
      status !== bot.status ||
      initialBalance !== bot.initialBalance ||
      effectiveQuoteAsset !== bot.quoteAsset ||
      slippagePct !== (bot.slippagePct ?? 0.5) ||
      marketConfigId !== bot.marketConfigId ||
      strategyConfigId !== bot.strategyConfigId
    : false

  const canSave =
    name.trim().length > 0 &&
    !!marketConfigId &&
    !!strategyConfigId &&
    initialBalance > 0 &&
    slippagePct >= 0 &&
    slippagePct <= 50

  const handleSave = async () => {
    if (!bot || !canSave || !isDirty) return
    setSaving(true)
    setError(null)
    try {
      const baseAsset =
        effectiveQuoteAsset === bot.baseAsset ? bot.quoteAsset : bot.baseAsset
      await updateServerBot(bot.id, {
        name: name.trim(),
        mode,
        status,
        initialBalance,
        slippagePct,
        marketConfigId,
        strategyConfigId,
        quoteAsset: effectiveQuoteAsset,
        baseAsset,
      })
      navigate(`/bots/${bot.id}?mode=demo&trade=auto`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageContent className="py-12 text-center text-muted">
        Загрузка бота…
      </PageContent>
    )
  }

  if (error && !bot) {
    return (
      <PageContent className="py-12 text-center">
        <p className="text-error mb-4">{error}</p>
        <Link to="/bots">
          <Button variant="outline">К списку ботов</Button>
        </Link>
      </PageContent>
    )
  }

  if (!bot) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={name.trim() || 'Редактирование бота'}
        subtitle={`Серверный бот · ${bot.baseAsset}/${bot.quoteAsset}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to={`/bots/${bot.id}?mode=demo&trade=auto`}>
              <Button variant="outline">
                <ArrowLeft size={14} /> К боту
              </Button>
            </Link>
            <Button onClick={handleSave} disabled={!canSave || !isDirty || saving}>
              <Save size={14} />
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        }
      />

      <PageContent className="flex-1 min-h-0 overflow-y-auto space-y-5 max-w-4xl">
        {error && (
          <Card className="px-4 py-3 text-sm text-error">{error}</Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-xs text-muted">PnL</p>
            <p className={cn('text-lg font-bold', bot.pnlPct >= 0 ? 'text-success' : 'text-error')}>
              {formatPercent(bot.pnlPct)}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted">Баланс</p>
            <p className="text-lg font-bold text-white">{formatCurrency(bot.balance)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted">Win Rate</p>
            <p className="text-lg font-bold text-white">{bot.winRate}%</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted">Status</p>
            <div className="mt-1">
              <StatusBadge
                status={bot.status === 'running' ? 'active' : bot.status === 'paused' ? 'paused' : 'stopped'}
              />
            </div>
          </Card>
        </div>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Основное</h2>
          <div>
            <label className="text-sm text-muted block mb-1.5">Название</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted block mb-1.5">Режим</label>
              <Select
                value={mode}
                onChange={(value) => setMode(value as ServerBotMode)}
                options={[
                  { value: 'demo-live', label: 'Демо' },
                  { value: 'real-live', label: 'Реальный' },
                  { value: 'idle', label: 'Выкл' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1.5">Статус</label>
              <Select
                value={status}
                onChange={(value) => setStatus(value as ServerBotStatus)}
                options={[
                  { value: 'running', label: 'Запущен' },
                  { value: 'paused', label: 'Пауза' },
                  { value: 'stopped', label: 'Остановлен' },
                ]}
                className="w-full"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Счёт и рынок</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted block mb-1.5">Начальный баланс</label>
              <input
                type="number"
                min={1}
                value={initialBalance}
                onChange={(e) => setInitialBalance(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1.5">Валюта баланса</label>
              <Select
                value={effectiveQuoteAsset}
                onChange={setQuoteAsset}
                options={assetOptions.map((sym) => ({ value: sym, label: sym }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1.5">Проскальзывание, %</label>
              <input
                type="number"
                min={0}
                max={50}
                step={0.1}
                value={slippagePct}
                onChange={(e) => setSlippagePct(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Конфигурации</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted block mb-1.5">Конфигурация рынков</label>
              <Select
                value={marketConfigId}
                onChange={setMarketConfigId}
                options={marketConfigs.map((m) => ({ value: m.id, label: m.name }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1.5">Стратегия</label>
              <Select
                value={strategyConfigId}
                onChange={setStrategyConfigId}
                options={strategyConfigs.map((s) => ({ value: s.id, label: s.name }))}
                className="w-full"
              />
            </div>
          </div>
        </Card>
      </PageContent>
    </div>
  )
}
