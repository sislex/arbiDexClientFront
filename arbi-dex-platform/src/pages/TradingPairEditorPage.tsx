import { useCallback, useEffect, useState } from 'react'
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
import { useCatalogPairs } from '../hooks/useCatalogPairs'
import { getTradingPairById } from '../data/mockData'
import { selectionFromSearchParams, selectionToSearchParams } from '../lib/pairUrlParams'
import { selectionToTradingPair } from '../lib/pairEditorUtils'
import { loadTradingPairs, saveTradingPairs } from '../lib/tradingPairsStorage'
import { generateSelectionId } from '../types/chart'

export function TradingPairEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pairs: catalogPairs } = useCatalogPairs()

  const existingPair = !isNew && id ? getTradingPairById(id) : undefined

  const [selections, setSelections] = useState<ChartPairSelection[]>(() => {
    if (existingPair) return [selectionFromTradingPairRecord(existingPair)]
    const defaultPair = catalogPairs[0] ?? 'BTC/USDT'
    return buildInitialSelections(defaultPair)
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (isNew) {
      const defaultPair = catalogPairs[0] ?? 'BTC/USDT'
      const base = buildInitialSelections(defaultPair)
      const merged = base.map((sel, index) =>
        index === 0 ? selectionFromSearchParams(searchParams, sel) : sel,
      )
      setSelections(merged)
      return
    }
    if (!existingPair) return
    const base = [selectionFromTradingPairRecord(existingPair)]
    setSelections([selectionFromSearchParams(searchParams, base[0])])
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, existingPair?.id, catalogPairs[0]])

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
    setSaved(false)
  }

  const handleSave = () => {
    const primary = selections[0]
    if (!primary?.pair) return

    if (isNew) {
      const newEntries = selections.map((sel) =>
        selectionToTradingPair({ ...sel, id: sel.id || generateSelectionId() }),
      )
      const all = [...loadTradingPairs(), ...newEntries]
      saveTradingPairs(all)
      const last = newEntries[newEntries.length - 1]
      if (last) {
        const sel = selections.find((s) => s.id === last.id) ?? selections[0]
        if (sel) {
          navigate(`/pairs/${last.id}?${new URLSearchParams(selectionToSearchParams(sel)).toString()}`, {
            replace: true,
          })
          return
        }
      }
      navigate('/pairs')
    }

    if (!existingPair) return
    const updated = selectionToTradingPair(primary, existingPair)
    const all = loadTradingPairs().map((p) => (p.id === existingPair.id ? updated : p))
    saveTradingPairs(all)
    setSaved(true)
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

  const primary = selections[0]

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
            <Button onClick={handleSave} disabled={!primary?.pair}>
              <Save size={14} />
              {isNew ? 'Создать' : saved ? 'Сохранено' : 'Сохранить'}
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
        </Card>

        {primary && (
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Параметры в URL</h2>
            <p className="text-xs text-muted">
              Настройки набора синхронизируются с адресной строкой.
            </p>
            <div className="rounded-xl bg-surface border border-border p-3 font-mono text-xs text-muted break-all">
              /pairs/{isNew ? 'new' : existingPair?.id}
              {searchParams.toString() ? `?${searchParams.toString()}` : ''}
            </div>
          </Card>
        )}
      </PageContent>
    </>
  )
}
