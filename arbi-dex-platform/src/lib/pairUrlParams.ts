import type { ChartPairSelection, DexEntry, PairPurpose } from '../types/chart'
import { emptyDexAddresses, rebuildSelectedExchanges } from '../types/chart'

export function selectionToSearchParams(sel: ChartPairSelection): Record<string, string> {
  const out: Record<string, string> = {}
  if (sel.name.trim()) out.name = sel.name.trim()
  if (sel.pair) out.pair = sel.pair
  out.purpose = sel.purpose
  if (sel.tradingExchange) out.tradingExchange = sel.tradingExchange
  if (sel.selectedExchanges.length > 0) out.exchanges = sel.selectedExchanges.join(',')
  for (const entry of sel.dexEntries ?? []) {
    out[`dex.${entry.id}.network`] = entry.network
    const addrs = sel.dexAddresses?.[entry.id]
    if (addrs?.base) out[`dex.${entry.id}.base`] = addrs.base
    if (addrs?.quote) out[`dex.${entry.id}.quote`] = addrs.quote
  }
  return out
}

export function selectionFromSearchParams(
  params: URLSearchParams,
  fallback: ChartPairSelection,
): ChartPairSelection {
  const hasCoreParams = ['name', 'pair', 'purpose', 'tradingExchange', 'exchanges'].some((k) =>
    params.has(k),
  )
  if (!hasCoreParams && ![...params.keys()].some((k) => k.startsWith('dex.'))) {
    return fallback
  }

  const dexEntryIds = new Set<string>()
  for (const key of params.keys()) {
    const match = key.match(/^dex\.([^.]+)\./)
    if (match) dexEntryIds.add(match[1])
  }

  const dexEntries: DexEntry[] = []
  const dexAddresses: Record<string, ReturnType<typeof emptyDexAddresses>> = {}

  for (const entryId of dexEntryIds) {
    const network = params.get(`dex.${entryId}.network`) ?? ''
    if (!network) continue
    dexEntries.push({ id: entryId, network })
    dexAddresses[entryId] = {
      base: params.get(`dex.${entryId}.base`) ?? '',
      quote: params.get(`dex.${entryId}.quote`) ?? '',
    }
  }

  const exchangesRaw = params.get('exchanges')
  const dexEntriesFinal = dexEntries.length > 0 ? dexEntries : fallback.dexEntries
  const selectedExchangesRaw = exchangesRaw
    ? exchangesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : fallback.selectedExchanges
  const selectedExchanges = rebuildSelectedExchanges(selectedExchangesRaw, dexEntriesFinal)

  const purpose = (params.get('purpose') as PairPurpose | null) ?? fallback.purpose
  const tradingExchangeRaw = params.get('tradingExchange')
  const tradingExchange =
    purpose === 'monitoring'
      ? null
      : tradingExchangeRaw ?? fallback.tradingExchange

  return {
    ...fallback,
    name: params.get('name') ?? fallback.name,
    pair: params.get('pair') ?? fallback.pair,
    purpose,
    selectedExchanges,
    tradingExchange,
    dexEntries: dexEntriesFinal,
    dexAddresses: dexEntries.length > 0 ? dexAddresses : fallback.dexAddresses,
  }
}

export function selectionsToSearchParams(selections: ChartPairSelection[]): Record<string, string> {
  const primary = selections[0]
  if (!primary) return {}
  return selectionToSearchParams(primary)
}
