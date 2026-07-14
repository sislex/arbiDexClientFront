export type PairPurpose = 'trading' | 'monitoring'

export interface DexTokenAddresses {
  base: string
  quote: string
}

/** Добавленный DEX — сеть + уникальный id (можно несколько на одну сеть) */
export interface DexEntry {
  id: string
  network: string
}

export function getDexEntryLabel(entry: DexEntry, entries: DexEntry[]): string {
  const peers = entries.filter((e) => e.network === entry.network)
  if (peers.length <= 1) return entry.network
  const sortedPeers = [...peers].sort((a, b) => a.id.localeCompare(b.id))
  const index = sortedPeers.findIndex((e) => e.id === entry.id)
  if (index < 0) return entry.network
  return `${entry.network} #${index + 1}`
}

export function isDexEntryLabel(name: string, entries: DexEntry[]): boolean {
  return entries.some((entry) => getDexEntryLabel(entry, entries) === name)
}

/** Известные DEX-сети — не CEX, не должны висеть в списке без активной DEX-записи */
const DEX_NETWORK_NAMES = new Set([
  'Ethereum',
  'Arbitrum',
  'Optimism',
  'Base',
  'Polygon',
  'BSC',
  'Avalanche',
  'zkSync',
  'Linea',
  'Fantom',
])

const LEGACY_DEX_LABEL_MAP: Record<string, string> = {
  Uniswap: 'Ethereum',
  'Arbitrum DEX': 'Arbitrum',
}

export function normalizeExchangeLabel(name: string): string {
  return LEGACY_DEX_LABEL_MAP[name] ?? name
}

export function isDexNetworkName(name: string): boolean {
  return DEX_NETWORK_NAMES.has(name)
}

/** Текущая или устаревшая DEX-метка (не CEX) */
export function isDexRelatedLabel(name: string, dexEntries: DexEntry[]): boolean {
  const normalized = normalizeExchangeLabel(name)
  if (isDexEntryLabel(normalized, dexEntries)) return true
  if (isDexEntryLabel(name, dexEntries)) return true
  if (/^.+\s#\d+$/.test(normalized)) return true
  if (dexEntries.some((e) => e.network === normalized || e.network === name)) return true
  if (isDexNetworkName(normalized)) return true
  if (name in LEGACY_DEX_LABEL_MAP) return true
  return false
}

export function getEnabledDexEntryIds(
  dexEntries: DexEntry[],
  selectedExchanges: string[],
): Set<string> {
  return new Set(
    dexEntries
      .filter((entry) => selectedExchanges.includes(getDexEntryLabel(entry, dexEntries)))
      .map((entry) => entry.id),
  )
}

export function mergeSelectedExchanges(
  selectedExchanges: string[],
  dexEntries: DexEntry[],
  enabledDexEntryIds: Iterable<string>,
): string[] {
  const cex = selectedExchanges.filter((ex) => !isDexRelatedLabel(ex, dexEntries))
  const enabledIds = new Set(enabledDexEntryIds)
  const dexLabels = dexEntries
    .filter((entry) => enabledIds.has(entry.id))
    .map((entry) => getDexEntryLabel(entry, dexEntries))
  return [...new Set([...cex, ...dexLabels])]
}

export function rebuildSelectedExchanges(
  selectedExchanges: string[],
  dexEntries: DexEntry[],
): string[] {
  const normalized = selectedExchanges.map(normalizeExchangeLabel)
  const enabledIds = getEnabledDexEntryIds(dexEntries, normalized)
  return mergeSelectedExchanges(normalized, dexEntries, enabledIds)
}

export function resolveDexTradingExchange(
  tradingExchange: string | null,
  oldDexEntries: DexEntry[],
  newDexEntries: DexEntry[],
): string | null {
  if (!tradingExchange) return null
  const tradingEntry = oldDexEntries.find(
    (entry) => getDexEntryLabel(entry, oldDexEntries) === tradingExchange,
  )
  if (tradingEntry) {
    return getDexEntryLabel(tradingEntry, newDexEntries)
  }
  return tradingExchange
}

export interface ChartPairSelection {
  id: string
  name: string
  pair: string
  purpose: PairPurpose
  selectedExchanges: string[]
  /** null — только отслеживание, без торговой биржи */
  tradingExchange: string | null
  /** Адреса токенов для DEX (ключ — id записи) */
  dexAddresses: Record<string, DexTokenAddresses>
  dexEntries: DexEntry[]
}

export function generateSelectionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function defaultPairSetName(pair: string): string {
  return pair.replace('/', ' / ')
}

export function isMonitoringSelection(sel: ChartPairSelection): boolean {
  return sel.purpose === 'monitoring'
}

export function emptyDexAddresses(): DexTokenAddresses {
  return { base: '', quote: '' }
}

export function createDefaultSelection(
  pair: string,
  exchanges: string[],
  tradingExchange: string | null,
  options?: {
    name?: string
    purpose?: PairPurpose
    dexAddresses?: Record<string, DexTokenAddresses>
    dexEntries?: DexEntry[]
  },
): ChartPairSelection {
  const purpose = options?.purpose ?? 'trading'
  return {
    id: generateSelectionId(),
    name: options?.name ?? defaultPairSetName(pair),
    pair,
    purpose,
    selectedExchanges: [...exchanges],
    tradingExchange: purpose === 'monitoring' ? null : tradingExchange,
    dexAddresses: options?.dexAddresses ?? {},
    dexEntries: options?.dexEntries ?? [],
  }
}

export function createMonitoringSelection(
  pair: string,
  exchanges: string[],
  name?: string,
): ChartPairSelection {
  return createDefaultSelection(pair, exchanges, null, { name, purpose: 'monitoring' })
}

export function seriesKey(pair: string, exchange: string): string {
  return `${pair}::${exchange}`
}

export function parseSeriesKey(key: string): { pair: string; exchange: string } {
  const [pair, exchange] = key.split('::')
  return { pair, exchange }
}
