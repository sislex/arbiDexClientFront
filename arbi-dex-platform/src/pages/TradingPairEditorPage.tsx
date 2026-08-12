import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader, PageContent } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import {
  AddPairsGridForm,
  buildInitialSelections,
  selectionFromTradingPairRecord,
} from '../components/forms/AddPairsGridForm'
import type { ChartPairSelection } from '../types/chart'
import { CEX_SOURCES, getTradingPairById } from '../data/mockData'
import { selectionFromSearchParams, selectionToSearchParams } from '../lib/pairUrlParams'
import { selectionToTradingPair } from '../lib/pairEditorUtils'
import { loadTradingPairs, saveTradingPairs } from '../lib/tradingPairsStorage'
import { loadBots, saveBots } from '../lib/botsStorage'
import { getDefaultCexPairSymbol } from '../lib/pairSymbols'
import {
  hasChartPairSelectionChanged,
  isChartPairSelectionComplete,
} from '../lib/editorFormState'
import { generateSelectionId } from '../types/chart'
import { useAuth } from '../context/AuthContext'
import { syncBotToServer } from '../lib/syncBotToServer'
import { useStoreMarketCatalog } from '../hooks/useStoreMarketCatalog'

function cexNamesFromStore(cexSourceIds: string[]): string[] {
  const byId = new Map(CEX_SOURCES.map((s) => [s.id, s.name]))
  return cexSourceIds
    .map((id) => byId.get(id) ?? id.charAt(0).toUpperCase() + id.slice(1))
    .filter(Boolean)
}

export function TradingPairEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { catalog, loading: catalogLoading } = useStoreMarketCatalog()
  const { isAuthenticated } = useAuth()
  const [saving, setSaving] = useState(false)

  const existingPair = !isNew && id ? getTradingPairById(id) : undefined
  const storeCexNames = useMemo(
    () => cexNamesFromStore(catalog.cexSourceIds),
    [catalog.cexSourceIds],
  )
  const defaultPair = useMemo(
    () => getDefaultCexPairSymbol(catalog.pairSymbols),
    [catalog.pairSymbols],
  )

  const [selections, setSelections] = useState<ChartPairSelection[]>(() => {
    if (existingPair) return [selectionFromTradingPairRecord(existingPair)]
    return buildInitialSelections(defaultPair, storeCexNames)
  })
  const baselineSelectionRef = useRef<ChartPairSelection | null>(
    existingPair ? selectionFromTradingPairRecord(existingPair) : null,
  )
  const initializedFromStoreRef = useRef(!isNew)

  useEffect(() => {
    if (isNew) {
      if (catalogLoading && catalog.pairSymbols.length === 0) return
      // Один раз подставляем дефолты из store (не затирать правки пользователя)
      if (initializedFromStoreRef.current) return
      initializedFromStoreRef.current = true

      const base = buildInitialSelections(defaultPair, storeCexNames)
      const merged = base.map((sel, index) =>
        index === 0 ? selectionFromSearchParams(searchParams, sel) : sel,
      )
      setSelections(merged)
      baselineSelectionRef.current = null
      return
    }
    if (!existingPair) return
    const base = selectionFromTradingPairRecord(existingPair)
    const merged = selectionFromSearchParams(searchParams, base)
    setSelections([merged])
    baselineSelectionRef.current = merged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, existingPair?.id, defaultPair, storeCexNames.join('|'), catalogLoading])

  const syncUrl = useCallback(
    (nextSelections: ChartPairSelection[]) => {
      const primary = nextSelections[0]
      if (!primary) return
      setSearchParams(selectionToSearchParams(primary), { replace: true })
    },
    [setSearchParams],
  )

  const handleChange = (next: ChartPairSelection[]) => {
    setSelections(next)
    syncUrl(next)
  }

  const primary = selections[0]
  const canCreate = isChartPairSelectionComplete(primary)
  const isDirty = hasChartPairSelectionChanged(primary, baselineSelectionRef.current ?? undefined)
  const submitEnabled = isNew ? canCreate : isDirty && canCreate

  const handleSave = async () => {
    if (!submitEnabled || !primary?.pair || saving) return
    setSaving(true)
    try {
      // Пустой список ≠ «запретить все CEX»: пока каталог не готов, не фильтруем.
      const allowedCex = storeCexNames.length > 0 ? storeCexNames : undefined
      if (isNew) {
        const newEntries = selections.map((sel) =>
          selectionToTradingPair(
            { ...sel, id: sel.id || generateSelectionId() },
            undefined,
            allowedCex,
          ),
        )
        const all = [...loadTradingPairs(), ...newEntries]
        saveTradingPairs(all)
        navigate('/pairs')
        return
      }

      if (!existingPair) return
      const updated = selectionToTradingPair(primary, existingPair, allowedCex)
      const all = loadTradingPairs().map((p) => (p.id === existingPair.id ? updated : p))
      saveTradingPairs(all)

      const bots = loadBots()
      const linked = bots.filter((bot) => bot.pairSetId === updated.id)
      if (linked.length > 0) {
        const withUpdatedPair = bots.map((bot) =>
          bot.pairSetId === updated.id ? { ...bot, pair: updated.pair } : bot,
        )
        if (isAuthenticated) {
          const synced = await Promise.all(
            withUpdatedPair.map(async (bot) => {
              if (bot.pairSetId !== updated.id) return bot
              return syncBotToServer(bot, { pairSet: updated })
            }),
          )
          saveBots(synced)
        } else {
          saveBots(withUpdatedPair)
        }
      }

      navigate('/pairs')
    } finally {
      setSaving(false)
    }
  }

  if (!isNew && id && !existingPair) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
        <p className="text-muted">Торговый набор не найден</p>
        <Link to="/pairs">
          <Button variant="outline">
            <ArrowLeft size={14} /> К списку пар
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={isNew ? 'Новый набор пар' : primary?.name || 'Редактирование набора'}
        subtitle={isNew ? 'Создание набора в Trading Pairs' : `ID: ${existingPair?.id ?? id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/pairs">
              <Button variant="outline">
                <ArrowLeft size={14} /> Назад
              </Button>
            </Link>
            <Button onClick={() => void handleSave()} disabled={!submitEnabled || saving}>
              <Save size={14} />
              Сохранить
            </Button>
          </div>
        }
      />

      <PageContent className="space-y-5 max-w-5xl">
        <Card className="p-5">
          <AddPairsGridForm
            selections={selections}
            onChange={handleChange}
            mode={isNew ? 'add' : 'edit'}
          />
          <div className="flex flex-wrap items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
            <Link to="/pairs">
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </Link>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!submitEnabled || saving}
            >
              <Save size={14} />
              Сохранить
            </Button>
          </div>
        </Card>
      </PageContent>
    </>
  )
}
