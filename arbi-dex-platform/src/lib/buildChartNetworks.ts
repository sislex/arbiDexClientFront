import { getExchangeColor, isCexExchange } from '../data/mockData'
import { defaultDexAddresses, findDexStoreKeysFromCatalog, resolveDexStoreKeysForPair, buildPreferredDexStoreKeys } from './dexStoreKeys'
import { exchangeId } from '../simulation/simulationNetworkTypes'
import type { NetworkSource } from '../simulation/simulationNetworkTypes'
import type { ChartPairSelection } from '../types/chart'
import { getDexEntryLabel, isDexNetworkName, normalizeExchangeLabel } from '../types/chart'

export function networkIdForExchange(exchange: string, pair: string): string {
  const ex = exchangeId(exchange)
  return `${ex}-${pair.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function networkIdForDex(network: string, base: string, quote: string): string {
  return `dex-${network.toLowerCase()}-${base.slice(0, 10)}-${quote.slice(0, 10)}`
}

function resolveCexNetwork(
  exchangeLabel: string,
  pair: string,
  catalog: Set<string>,
): NetworkSource | null {
  const ex = exchangeId(exchangeLabel)
  const bidKey = `${ex}|${pair}|bidPrice`
  const askKey = `${ex}|${pair}|askPrice`
  if (!catalog.has(bidKey) || !catalog.has(askKey)) return null

  return {
    id: networkIdForExchange(exchangeLabel, pair),
    label: exchangeLabel,
    color: getExchangeColor(exchangeLabel),
    bidKey,
    askKey,
    transform: (v: number) => v,
  }
}

function resolveDexNetwork(
  exchangeLabel: string,
  selection: ChartPairSelection,
  catalog: Set<string>,
): NetworkSource | null {
  const dexEntries = selection.dexEntries ?? []
  const entry = dexEntries.find((e) => getDexEntryLabel(e, dexEntries) === exchangeLabel)
  if (!entry) return null

  const saved = selection.dexAddresses?.[entry.id]
  let baseAddr = saved?.base?.trim() ?? ''
  let quoteAddr = saved?.quote?.trim() ?? ''

  if (!baseAddr || !quoteAddr) {
    const discovered = findDexStoreKeysFromCatalog(entry.network, selection.pair, catalog)
    if (discovered) {
      baseAddr = discovered.base
      quoteAddr = discovered.quote
    } else {
      const defaults = defaultDexAddresses(entry.network, selection.pair)
      if (!defaults) return null
      baseAddr = defaults.base
      quoteAddr = defaults.quote
    }
  }

  const resolved = resolveDexStoreKeysForPair(
    entry.network,
    baseAddr,
    quoteAddr,
    selection.pair,
    catalog,
  )
  if (!resolved) return null

  const [pathBase, pathQuote] = resolved.path.split('/')

  return {
    id: networkIdForDex(entry.network.toLowerCase(), pathBase, pathQuote),
    label: exchangeLabel,
    color: getExchangeColor(entry.network),
    bidKey: resolved.bidKey,
    askKey: resolved.askKey,
    transform: (v: number) => v,
  }
}

function resolveDexNetworkByName(
  networkLabel: string,
  pair: string,
  catalog: Set<string>,
): NetworkSource | null {
  const normalized = normalizeExchangeLabel(networkLabel)
  if (!isDexNetworkName(normalized)) return null

  const discovered = findDexStoreKeysFromCatalog(normalized, pair, catalog)
  if (!discovered) return null

  const [pathBase, pathQuote] = discovered.path.split('/')
  return {
    id: networkIdForDex(normalized.toLowerCase(), pathBase, pathQuote),
    label: networkLabel,
    color: getExchangeColor(normalized),
    bidKey: discovered.bidKey,
    askKey: discovered.askKey,
    transform: (v: number) => v,
  }
}

/** @deprecated Используйте resolveChartNetworks с каталогом store keys. */
export function buildChartNetworks(selection: ChartPairSelection): NetworkSource[] {
  return selection.selectedExchanges.map((exchange) => {
    const ex = exchangeId(exchange)
    const id = networkIdForExchange(exchange, selection.pair)
    if (isCexExchange(exchange)) {
      return {
        id,
        label: exchange,
        color: getExchangeColor(exchange),
        bidKey: `${ex}|${selection.pair}|bidPrice`,
        askKey: `${ex}|${selection.pair}|askPrice`,
        transform: (v: number) => v,
      }
    }
    const dexEntries = selection.dexEntries ?? []
    const entry = dexEntries.find((e) => getDexEntryLabel(e, dexEntries) === exchange)
    const addrs = entry ? selection.dexAddresses?.[entry.id] : undefined
    const network = entry?.network ?? exchange
    const defaults = entry ? defaultDexAddresses(network, selection.pair) : null
    const baseAddr = addrs?.base?.trim() || defaults?.base || 'x'
    const quoteAddr = addrs?.quote?.trim() || defaults?.quote || 'y'
    const resolved = buildPreferredDexStoreKeys(network, baseAddr, quoteAddr, selection.pair)
    const path = resolved.path
    const [pathBase, pathQuote] = path.split('/')
    return {
      id: networkIdForDex(network.toLowerCase(), pathBase, pathQuote),
      label: exchange,
      color: getExchangeColor(entry?.network ?? exchange),
      bidKey: resolved.bidKey,
      askKey: resolved.askKey,
      transform: (v: number) => v,
    }
  })
}

/** Только биржи, для которых в store есть bid/ask. */
export function resolveChartNetworks(
  selection: ChartPairSelection,
  catalog: readonly string[],
): NetworkSource[] {
  const catalogSet = new Set(catalog)
  const networks: NetworkSource[] = []

  for (const exchangeLabel of selection.selectedExchanges) {
    const net = isCexExchange(exchangeLabel)
      ? resolveCexNetwork(exchangeLabel, selection.pair, catalogSet)
      : resolveDexNetwork(exchangeLabel, selection, catalogSet) ??
        resolveDexNetworkByName(exchangeLabel, selection.pair, catalogSet)
    if (net) networks.push(net)
  }

  return networks
}

export function referenceNetworks(
  selection: ChartPairSelection,
  networks: NetworkSource[],
): NetworkSource[] {
  if (selection.purpose === 'monitoring' || !selection.tradingExchange) {
    return networks
  }
  return networks.filter((net) => net.label !== selection.tradingExchange)
}

export function tradingNetwork(
  selection: ChartPairSelection,
  networks: NetworkSource[],
): NetworkSource | undefined {
  if (selection.purpose === 'monitoring' || !selection.tradingExchange) return undefined
  return networks.find((net) => net.label === selection.tradingExchange)
}
