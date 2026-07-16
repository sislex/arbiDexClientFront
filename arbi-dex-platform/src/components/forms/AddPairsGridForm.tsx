import { useMemo } from 'react'
import { Plus, Trash2, Check, Star, Eye, TrendingUp } from 'lucide-react'
import {
  CEX_SOURCES,
  DEX_NETWORKS,
  getDefaultTradingExchange,
  getExchangesForPair,
  migrateDexData,
} from '../../data/mockData'
import { useCatalogPairs } from '../../hooks/useCatalogPairs'
import { filterStandardCexPairSymbols, isStandardCexPairSymbol } from '../../lib/pairSymbols'
import {
  defaultDexAddresses,
  dexPoolPresetValue,
  findDexPoolPreset,
  formatDexPoolOptionLabel,
  getDexPoolPresets,
} from '../../lib/dexStoreKeys'
import type { ExchangeSource } from '../../data/mockData'
import type { ChartPairSelection, DexEntry, DexTokenAddresses, PairPurpose } from '../../types/chart'
import {
  createDefaultSelection,
  defaultPairSetName,
  emptyDexAddresses,
  generateSelectionId,
  getDexEntryLabel,
  getEnabledDexEntryIds,
  isDexRelatedLabel,
  isMonitoringSelection,
  mergeSelectedExchanges,
  rebuildSelectedExchanges,
  resolveDexTradingExchange,
} from '../../types/chart'
import { cn } from '../../lib/utils'
import { Select } from '../ui/SearchInput'

interface AddPairsGridFormProps {
  selections: ChartPairSelection[]
  onChange: (selections: ChartPairSelection[]) => void
  mode?: 'add' | 'edit'
}

function CardControls({
  active,
  isTrading,
  showTradingStar,
  onSetTrading,
}: {
  active: boolean
  isTrading: boolean
  showTradingStar: boolean
  onSetTrading: () => void
}) {
  return (
    <div className="absolute top-3 right-3 flex items-center gap-1">
      {showTradingStar && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSetTrading()
          }}
          title={isTrading ? 'Снять торговую биржу' : 'Назначить торговой'}
          className={cn(
            'p-1 rounded-md transition-colors',
            isTrading ? 'text-accent-purple' : 'text-muted/40 hover:text-accent-purple',
          )}
        >
          <Star size={16} fill={isTrading ? 'currentColor' : 'none'} />
        </button>
      )}
      {active && (
        <span className="w-5 h-5 rounded-full bg-accent-purple flex items-center justify-center">
          <Check size={12} className="text-white" />
        </span>
      )}
    </div>
  )
}

function CexExchangeCard({
  source,
  active,
  isTrading,
  showTradingStar,
  onToggle,
  onSetTrading,
}: {
  source: ExchangeSource
  active: boolean
  isTrading: boolean
  showTradingStar: boolean
  onToggle: () => void
  onSetTrading: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'relative flex flex-col p-4 rounded-xl border transition-all duration-150 min-h-[72px] cursor-pointer',
        active
          ? 'border-accent-cyan/40 bg-accent-cyan/5 ring-1 ring-accent-cyan/20'
          : 'border-border bg-card opacity-60',
        isTrading && active && showTradingStar && 'ring-2 ring-accent-purple/50',
      )}
    >
      <CardControls active={active} isTrading={isTrading} showTradingStar={showTradingStar} onSetTrading={onSetTrading} />
      <span className="text-base font-semibold text-white pr-14">{source.name}</span>
      {isTrading && active && showTradingStar && (
        <span className="absolute bottom-3 right-3 text-[10px] font-medium text-accent-purple uppercase tracking-wide">
          Trade
        </span>
      )}
    </div>
  )
}

function DexEntryCard({
  entry,
  entries,
  pair,
  active,
  isTrading,
  showTradingStar,
  addresses,
  onToggle,
  onSetTrading,
  onNetworkChange,
  onPoolChange,
  onRemove,
}: {
  entry: DexEntry
  entries: DexEntry[]
  pair: string
  active: boolean
  isTrading: boolean
  showTradingStar: boolean
  addresses: DexTokenAddresses
  onToggle: () => void
  onSetTrading: () => void
  onNetworkChange: (network: string) => void
  onPoolChange: (base: string, quote: string) => void
  onRemove: () => void
}) {
  const label = getDexEntryLabel(entry, entries)
  const poolPresets = useMemo(
    () => getDexPoolPresets(entry.network, pair),
    [entry.network, pair],
  )
  const selectedPool = useMemo(
    () => findDexPoolPreset(entry.network, pair, addresses),
    [entry.network, pair, addresses],
  )
  const poolSelectValue = selectedPool
    ? dexPoolPresetValue(selectedPool)
    : dexPoolPresetValue(addresses)

  return (
    <div
      className={cn(
        'relative flex flex-col p-4 rounded-xl border transition-all duration-150 border-dashed',
        active
          ? 'border-accent-purple/40 bg-accent-purple/5 ring-1 ring-accent-purple/20'
          : 'border-border bg-card opacity-60',
        isTrading && active && showTradingStar && 'ring-2 ring-accent-purple/50',
      )}
    >
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded-md text-muted hover:text-error transition-colors"
          title="Удалить DEX"
        >
          <Trash2 size={14} />
        </button>
        <CardControls active={active} isTrading={isTrading} showTradingStar={showTradingStar} onSetTrading={onSetTrading} />
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="text-left w-full pr-16 mb-3"
      >
        <span className="text-base font-semibold text-white">{label}</span>
        <span className="block text-[11px] text-muted mt-0.5">
          {active ? 'Включён — клик, чтобы выключить' : 'Выключен — клик, чтобы включить'}
        </span>
      </button>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-muted block mb-1">Сеть</label>
          <Select
            value={entry.network}
            onChange={onNetworkChange}
            options={DEX_NETWORKS.map((n) => ({ value: n.name, label: n.name }))}
            className="w-full text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted block mb-1">Пул</label>
          {poolPresets.length > 0 ? (
            <Select
              value={poolSelectValue}
              onChange={(value) => {
                const [base, quote] = value.split('|')
                if (base && quote) onPoolChange(base, quote)
              }}
              options={poolPresets.map((preset) => ({
                value: dexPoolPresetValue(preset),
                label: formatDexPoolOptionLabel(preset),
              }))}
              className="w-full text-sm"
            />
          ) : (
            <p className="text-[11px] text-muted py-2">
              Нет доступных пулов для {pair} в этой сети
            </p>
          )}
        </div>
      </div>

      {isTrading && active && showTradingStar && (
        <span className="absolute bottom-3 right-3 text-[10px] font-medium text-accent-purple uppercase tracking-wide">
          Trade
        </span>
      )}
    </div>
  )
}

function PurposeToggle({ purpose, onChange }: { purpose: PairPurpose; onChange: (p: PairPurpose) => void }) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1.5">Назначение набора</label>
      <div className="inline-flex p-1 rounded-xl bg-surface border border-border w-full">
        <button
          type="button"
          onClick={() => onChange('trading')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            purpose === 'trading' ? 'bg-accent-purple/15 text-accent-purple' : 'text-muted hover:text-white',
          )}
        >
          <TrendingUp size={14} />
          Торговля
        </button>
        <button
          type="button"
          onClick={() => onChange('monitoring')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            purpose === 'monitoring' ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-muted hover:text-white',
          )}
        >
          <Eye size={14} />
          Мониторинг
        </button>
      </div>
      {purpose === 'monitoring' && (
        <p className="text-[11px] text-muted mt-1.5">
          Только отслеживание на графиках. Не используется в ботах, без торговой биржи.
        </p>
      )}
    </div>
  )
}

function PairSection({
  selection,
  canRemove,
  pairOptions,
  pairsLoading,
  onNameChange,
  onPurposeChange,
  onPairChange,
  onToggleExchange,
  onSetTradingExchange,
  onDexPoolChange,
  onAddDex,
  onRemoveDex,
  onDexNetworkChange,
  onToggleDex,
  onRemove,
}: {
  selection: ChartPairSelection
  canRemove: boolean
  pairOptions: { value: string; label: string }[]
  pairsLoading: boolean
  onNameChange: (name: string) => void
  onPurposeChange: (purpose: PairPurpose) => void
  onPairChange: (pair: string) => void
  onToggleExchange: (exchange: string) => void
  onSetTradingExchange: (exchange: string) => void
  onDexPoolChange: (entryId: string, base: string, quote: string) => void
  onAddDex: () => void
  onRemoveDex: (entryId: string) => void
  onDexNetworkChange: (entryId: string, network: string) => void
  onToggleDex: (entryId: string) => void
  onRemove: () => void
}) {
  const monitoring = isMonitoringSelection(selection)

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3 min-w-0">
          <PurposeToggle purpose={selection.purpose} onChange={onPurposeChange} />
          <div>
            <label className="text-xs text-muted block mb-1.5">Название набора</label>
            <input
              type="text"
              value={selection.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={monitoring ? 'Например: ETH Market Watch' : 'Например: BTC Binance Main'}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-white text-sm focus:outline-none focus:border-accent-purple/50"
            />
          </div>
          <p className="text-[10px] text-muted font-mono">ID: {selection.id}</p>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors shrink-0"
            title="Удалить набор"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-white mb-1">
          {monitoring ? 'Биржи для отслеживания' : 'Sources'}
        </p>
        <p className="text-xs text-muted mb-4">
          Клик по карточке — включить/выключить · ★ — торговая биржа (повторный клик снимает отметку)
        </p>

        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-bold text-accent-cyan uppercase tracking-wider mb-3">CEX</h4>
            <div className="mb-4">
              <label className="text-xs text-muted block mb-1.5">Торговая пара</label>
              <Select
                value={selection.pair}
                onChange={onPairChange}
                options={
                  pairsLoading && pairOptions.length === 0
                    ? [{ value: selection.pair, label: 'Загрузка пар…' }]
                    : pairOptions
                }
                className="w-full text-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {CEX_SOURCES.map((source) => {
                const active = selection.selectedExchanges.includes(source.name)
                const isTrading = selection.tradingExchange === source.name
                return (
                  <CexExchangeCard
                    key={source.id}
                    source={source}
                    active={active}
                    isTrading={isTrading}
                    showTradingStar
                    onToggle={() => onToggleExchange(source.name)}
                    onSetTrading={() => onSetTradingExchange(source.name)}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <div>
                <h4 className="text-xs font-bold text-accent-purple uppercase tracking-wider">DEX</h4>
                <p className="text-[11px] text-muted mt-1">
                  Добавьте DEX, выберите сеть и пул с адресами токенов
                </p>
              </div>
              <button
                type="button"
                onClick={onAddDex}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-accent-purple/40 text-accent-purple hover:bg-accent-purple/10 transition-colors shrink-0"
              >
                <Plus size={14} />
                Добавить DEX
              </button>
            </div>
            <p className="text-[11px] text-muted mb-3">
              Пара набора: <span className="text-white font-medium">{selection.pair}</span>
            </p>
            {selection.dexEntries.length === 0 ? (
              <p className="text-xs text-muted py-6 text-center rounded-xl border border-dashed border-border">
                Нет добавленных DEX. Нажмите «Добавить DEX», чтобы выбрать сеть.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selection.dexEntries.map((entry) => {
                  const label = getDexEntryLabel(entry, selection.dexEntries)
                  const active = selection.selectedExchanges.includes(label)
                  const isTrading = selection.tradingExchange === label
                  const addresses = selection.dexAddresses[entry.id] ?? emptyDexAddresses()
                  return (
                    <DexEntryCard
                      key={entry.id}
                      entry={entry}
                      entries={selection.dexEntries}
                      pair={selection.pair}
                      active={active}
                      isTrading={isTrading}
                      showTradingStar
                      addresses={addresses}
                      onToggle={() => onToggleDex(entry.id)}
                      onSetTrading={() => onSetTradingExchange(label)}
                      onNetworkChange={(network) => onDexNetworkChange(entry.id, network)}
                      onPoolChange={(base, quote) => onDexPoolChange(entry.id, base, quote)}
                      onRemove={() => onRemoveDex(entry.id)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function AddPairsGridForm({ selections, onChange, mode = 'add' }: AddPairsGridFormProps) {
  const isEdit = mode === 'edit'
  const { pairs: catalogPairs, loading: pairsLoading } = useCatalogPairs()
  const pairOptions = useMemo(() => {
    const fromCatalog = filterStandardCexPairSymbols(catalogPairs)
    const fromSelections = selections.map((s) => s.pair).filter(isStandardCexPairSymbol)
    const symbols = [...new Set([...fromCatalog, ...fromSelections])].sort((a, b) =>
      a.localeCompare(b),
    )
    return symbols.map((p) => ({ value: p, label: p }))
  }, [catalogPairs, selections])

  const updateSelection = (id: string, patch: Partial<ChartPairSelection>) => {
    onChange(selections.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const setPurpose = (id: string, purpose: PairPurpose) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col
        if (purpose === 'monitoring') {
          return { ...col, purpose, tradingExchange: null }
        }
        const tradingExchange =
          col.tradingExchange && col.selectedExchanges.includes(col.tradingExchange)
            ? col.tradingExchange
            : null
        return { ...col, purpose: 'trading', tradingExchange }
      }),
    )
  }

  const toggleExchange = (id: string, exchange: string) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col
        const has = col.selectedExchanges.includes(exchange)
        const selectedExchanges = has
          ? col.selectedExchanges.filter((e) => e !== exchange)
          : [...col.selectedExchanges, exchange]

        let tradingExchange = col.tradingExchange
        if (has && tradingExchange === exchange) {
          tradingExchange = null
        }
        if (tradingExchange && !selectedExchanges.includes(tradingExchange)) {
          tradingExchange = null
        }

        const purpose = tradingExchange ? 'trading' : 'monitoring'
        return { ...col, selectedExchanges, tradingExchange, purpose }
      }),
    )
  }

  const addDex = (id: string) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col
        const network = DEX_NETWORKS[0]?.name ?? 'Ethereum'
        const entry: DexEntry = {
          id: generateSelectionId(),
          network,
        }
        const dexEntries = [...col.dexEntries, entry]
        const enabledIds = getEnabledDexEntryIds(col.dexEntries, col.selectedExchanges)
        enabledIds.add(entry.id)
        const preset =
          getDexPoolPresets(network, col.pair)[0] ??
          defaultDexAddresses(network, col.pair) ??
          emptyDexAddresses()
        return {
          ...col,
          dexEntries,
          dexAddresses: { ...col.dexAddresses, [entry.id]: { base: preset.base, quote: preset.quote } },
          selectedExchanges: mergeSelectedExchanges(col.selectedExchanges, dexEntries, enabledIds),
        }
      }),
    )
  }

  const removeDex = (id: string, entryId: string) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col
        const dexEntries = col.dexEntries.filter((e) => e.id !== entryId)
        const enabledIds = getEnabledDexEntryIds(col.dexEntries, col.selectedExchanges)
        enabledIds.delete(entryId)
        const dexAddresses = { ...col.dexAddresses }
        delete dexAddresses[entryId]
        const selectedExchanges = mergeSelectedExchanges(col.selectedExchanges, dexEntries, enabledIds)
        const tradingExchange = resolveDexTradingExchange(
          col.tradingExchange,
          col.dexEntries,
          dexEntries,
        )
        const finalTrading =
          tradingExchange && selectedExchanges.includes(tradingExchange) ? tradingExchange : null
        const purpose = finalTrading ? 'trading' : 'monitoring'
        return {
          ...col,
          dexEntries,
          dexAddresses,
          selectedExchanges,
          tradingExchange: finalTrading,
          purpose,
        }
      }),
    )
  }

  const changeDexNetwork = (id: string, entryId: string, network: string) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col
        const dexEntries = col.dexEntries.map((e) => (e.id === entryId ? { ...e, network } : e))
        const enabledIds = getEnabledDexEntryIds(col.dexEntries, col.selectedExchanges)
        const selectedExchanges = mergeSelectedExchanges(col.selectedExchanges, dexEntries, enabledIds)
        const tradingExchange = resolveDexTradingExchange(
          col.tradingExchange,
          col.dexEntries,
          dexEntries,
        )
        const finalTrading =
          tradingExchange && selectedExchanges.includes(tradingExchange) ? tradingExchange : null
        const purpose = finalTrading ? 'trading' : 'monitoring'
        const preset =
          getDexPoolPresets(network, col.pair)[0] ??
          defaultDexAddresses(network, col.pair) ??
          emptyDexAddresses()
        return {
          ...col,
          dexEntries,
          dexAddresses: { ...col.dexAddresses, [entryId]: { base: preset.base, quote: preset.quote } },
          selectedExchanges,
          tradingExchange: finalTrading,
          purpose,
        }
      }),
    )
  }

  const toggleDex = (id: string, entryId: string) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col
        const enabledIds = getEnabledDexEntryIds(col.dexEntries, col.selectedExchanges)
        if (enabledIds.has(entryId)) enabledIds.delete(entryId)
        else enabledIds.add(entryId)
        const selectedExchanges = mergeSelectedExchanges(
          col.selectedExchanges,
          col.dexEntries,
          enabledIds,
        )

        const entry = col.dexEntries.find((e) => e.id === entryId)
        const label = entry ? getDexEntryLabel(entry, col.dexEntries) : null
        let tradingExchange = col.tradingExchange
        if (label && !enabledIds.has(entryId) && tradingExchange === label) {
          tradingExchange = null
        }
        if (tradingExchange && !selectedExchanges.includes(tradingExchange)) {
          tradingExchange = null
        }

        const purpose = tradingExchange ? 'trading' : 'monitoring'
        return { ...col, selectedExchanges, tradingExchange, purpose }
      }),
    )
  }

  const setDexPool = (id: string, entryId: string, base: string, quote: string) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col
        return {
          ...col,
          dexAddresses: {
            ...col.dexAddresses,
            [entryId]: { base, quote },
          },
        }
      }),
    )
  }

  const setTradingExchange = (id: string, exchange: string) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col

        if (col.tradingExchange === exchange) {
          return { ...col, tradingExchange: null, purpose: 'monitoring' }
        }

        const selectedExchanges = col.selectedExchanges.includes(exchange)
          ? col.selectedExchanges
          : [...col.selectedExchanges, exchange]
        return { ...col, tradingExchange: exchange, purpose: 'trading', selectedExchanges }
      }),
    )
  }

  const changePair = (id: string, pair: string) => {
    onChange(
      selections.map((col) => {
        if (col.id !== id) return col
        const cexSelected = col.selectedExchanges.filter((ex) => !isDexRelatedLabel(ex, col.dexEntries))
        const enabledIds = getEnabledDexEntryIds(col.dexEntries, col.selectedExchanges)
        const dexLabels = mergeSelectedExchanges([], col.dexEntries, enabledIds)
        const keepMonitoring = col.purpose === 'monitoring' || !col.tradingExchange
        const tradingExchange = keepMonitoring
          ? null
          : col.tradingExchange &&
              (cexSelected.includes(col.tradingExchange) || dexLabels.includes(col.tradingExchange))
            ? col.tradingExchange
            : getDefaultTradingExchange(pair)
        const selectedExchanges = [...new Set([...cexSelected, ...dexLabels])]
        const dexAddresses = { ...col.dexAddresses }
        for (const entry of col.dexEntries) {
          const preset =
            getDexPoolPresets(entry.network, pair)[0] ??
            defaultDexAddresses(entry.network, pair)
          if (preset) {
            dexAddresses[entry.id] = { base: preset.base, quote: preset.quote }
          }
        }
        return {
          ...col,
          pair,
          name: col.name === defaultPairSetName(col.pair) ? defaultPairSetName(pair) : col.name,
          selectedExchanges,
          tradingExchange,
          dexAddresses,
          purpose: keepMonitoring ? 'monitoring' : tradingExchange ? 'trading' : 'monitoring',
        }
      }),
    )
  }

  const removePairSet = (id: string) => {
    if (selections.length <= 1) return
    onChange(selections.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-1">
      {selections.map((sel, index) => (
        <div key={sel.id}>
          {index > 0 && <div className="border-t border-border mb-8" />}
          <PairSection
            selection={sel}
            canRemove={!isEdit && selections.length > 1}
            pairOptions={pairOptions}
            pairsLoading={pairsLoading}
            onNameChange={(name) => updateSelection(sel.id, { name })}
            onPurposeChange={(purpose) => setPurpose(sel.id, purpose)}
            onPairChange={(pair) => changePair(sel.id, pair)}
            onToggleExchange={(ex) => toggleExchange(sel.id, ex)}
            onSetTradingExchange={(ex) => setTradingExchange(sel.id, ex)}
            onDexPoolChange={(entryId, base, quote) => setDexPool(sel.id, entryId, base, quote)}
            onAddDex={() => addDex(sel.id)}
            onRemoveDex={(entryId) => removeDex(sel.id, entryId)}
            onDexNetworkChange={(entryId, network) => changeDexNetwork(sel.id, entryId, network)}
            onToggleDex={(entryId) => toggleDex(sel.id, entryId)}
            onRemove={() => removePairSet(sel.id)}
          />
        </div>
      ))}

    </div>
  )
}

export function buildInitialSelections(primaryPair: string): ChartPairSelection[] {
  return [
    createDefaultSelection(
      primaryPair,
      getExchangesForPair(primaryPair),
      null,
      { purpose: 'monitoring' },
    ),
  ]
}

export function selectionFromTradingPairRecord(tp: {
  id: string
  name: string
  pair: string
  purpose?: PairPurpose
  exchanges: string[]
  tradingExchange: string | null
  dexAddresses?: Record<string, DexTokenAddresses>
  dexEntries?: DexEntry[]
}): ChartPairSelection {
  const purpose =
    tp.purpose === 'monitoring' || !tp.tradingExchange ? 'monitoring' : 'trading'
  const { dexEntries, dexAddresses } = migrateDexData(tp.dexAddresses ?? {}, tp.dexEntries ?? [])
  return {
    id: tp.id,
    name: tp.name,
    pair: tp.pair,
    purpose,
    selectedExchanges: rebuildSelectedExchanges([...tp.exchanges], dexEntries),
    tradingExchange: purpose === 'monitoring' ? null : tp.tradingExchange,
    dexAddresses,
    dexEntries,
  }
}
