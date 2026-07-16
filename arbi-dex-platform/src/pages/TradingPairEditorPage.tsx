import { useCallback, useEffect, useRef, useState } from 'react'
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
import { getDefaultCexPairSymbol } from '../lib/pairSymbols'
import {
  hasChartPairSelectionChanged,
  isChartPairSelectionComplete,
} from '../lib/editorFormState'
import { generateSelectionId } from '../types/chart'

export function TradingPairEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pairs: catalogPairs } = useCatalogPairs()

  const existingPair = !isNew && id ? getTradingPairById(id) : undefined

  const [selections, setSelections] = useState<ChartPairSelection[]>(() => {
    if (existingPair) return [selectionFromTradingPairRecord(existingPair)]
    const defaultPair = getDefaultCexPairSymbol(catalogPairs)
    return buildInitialSelections(defaultPair)
  })
  const baselineSelectionRef = useRef<ChartPairSelection | null>(
    existingPair ? selectionFromTradingPairRecord(existingPair) : null,
  )

  useEffect(() => {
    if (isNew) {
      const defaultPair = getDefaultCexPairSymbol(catalogPairs)
      const base = buildInitialSelections(defaultPair)
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
  }

  const primary = selections[0]
  const canCreate = isChartPairSelectionComplete(primary)
  const isDirty = hasChartPairSelectionChanged(primary, baselineSelectionRef.current ?? undefined)
  const submitEnabled = isNew ? canCreate : isDirty && canCreate

  const handleSave = () => {
    if (!submitEnabled || !primary?.pair) return

    if (isNew) {
      const newEntries = selections.map((sel) =>
        selectionToTradingPair({ ...sel, id: sel.id || generateSelectionId() }),
      )
      const all = [...loadTradingPairs(), ...newEntries]
      saveTradingPairs(all)
      navigate('/pairs')
      return
    }

    if (!existingPair) return
    const updated = selectionToTradingPair(primary, existingPair)
    const all = loadTradingPairs().map((p) => (p.id === existingPair.id ? updated : p))
    saveTradingPairs(all)
    navigate('/pairs')
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
            <Button onClick={handleSave} disabled={!submitEnabled}>
              <Save size={14} />
              {isNew ? 'Создать' : 'Сохранить'}
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
      </PageContent>
    </>
  )
}
