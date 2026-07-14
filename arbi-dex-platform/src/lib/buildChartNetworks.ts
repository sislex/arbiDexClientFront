import { getExchangeColor, isCexExchange } from '../data/mockData'
import { exchangeId } from '../simulation/simulationNetworkTypes'
import type { NetworkSource } from '../simulation/simulationNetworkTypes'
import type { ChartPairSelection } from '../types/chart'
import { getDexEntryLabel } from '../types/chart'

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

  const addrs = selection.dexAddresses?.[entry.id]
  if (!addrs?.base?.trim() || !addrs?.quote?.trim()) return null

  const network = entry.network.toLowerCase()
  const path = `${addrs.base.trim()}/${addrs.quote.trim()}`
  const bidKey = `dex:${network}|${path}|bidPrice`
  const askKey = `dex:${network}|${path}|askPrice`
  if (!catalog.has(bidKey) || !catalog.has(askKey)) return null

  return {
    id: networkIdForDex(network, addrs.base, addrs.quote),
    label: exchangeLabel,
    color: getExchangeColor(entry.network),
    bidKey,
    askKey,
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
    const network = entry?.network.toLowerCase() ?? exchange.toLowerCase()
    const path = addrs?.base && addrs?.quote ? `${addrs.base}/${addrs.quote}` : selection.pair
    return {
      id: networkIdForDex(network, addrs?.base ?? 'x', addrs?.quote ?? 'y'),
      label: exchange,
      color: getExchangeColor(entry?.network ?? exchange),
      bidKey: `dex:${network}|${path}|bidPrice`,
      askKey: `dex:${network}|${path}|askPrice`,
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
      : resolveDexNetwork(exchangeLabel, selection, catalogSet)
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
