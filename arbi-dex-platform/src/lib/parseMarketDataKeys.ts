const PRICE_FIELDS = new Set(['bidPrice', 'askPrice'])
const POOL_DISCOVERY_FIELDS = new Set(['bidPrice', 'askPrice', 'bidPool', 'askPool'])

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/i

/** Адрес контракта → человекочитаемый символ (lowercase keys). */
export const DEX_TOKEN_NAMES: Record<string, string> = {
  // Arbitrum
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'WETH',
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USDC',
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 'USDC.e',
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'USDT',
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 'WBTC',
  '0x912ce59144191c1204e64559fe8253a0e49e6548': 'ARB',
  // Ethereum mainnet
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
  // Optimism
  '0x4200000000000000000000000000000000000006': 'WETH',
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85': 'USDC',
  '0x7f5c764cbc14f9669b88837ca1490cca17c31607': 'USDC.e',
  '0x68f180fcce6836688e9084f035309e29bf0a2095': 'WBTC',
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': 'USDT',
  // Base
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 'cbBTC',
  // Linea
  '0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f': 'WETH',
  '0x176211869ca2b568f2a7d4ee941e073a821ee1ff': 'USDC',
  '0xa219439258ca9da29e9cc4ce5596924745e12b93': 'USDT',
  '0x3aab2285ddcddad8edf438c1bab47e1a9d05a9b4': 'WBTC',
  // Blast
  '0x4300000000000000000000000000000000000004': 'WETH',
  '0x4300000000000000000000000000000000000003': 'USDB',
}

const STABLE_SYMBOLS = new Set(['USDT', 'USDC', 'USDC.E', 'DAI', 'USD', 'BUSD', 'USDB'])

/**
 * Эквивалентные тикеры → один канонический символ для пар.
 * cbBTC / WBTC / BTC → BTC; WETH / ETH → ETH; USDB / USDC.e → USDC.
 */
const SYMBOL_ALIASES: Record<string, string> = {
  BTC: 'BTC',
  WBTC: 'BTC',
  CBBTC: 'BTC',
  CBTC: 'BTC',
  TBTC: 'BTC',
  ETH: 'ETH',
  WETH: 'ETH',
  USDC: 'USDC',
  'USDC.E': 'USDC',
  USDBC: 'USDC',
  USDB: 'USDC',
  USD: 'USDC',
}

/** USD-стейблы взаимозаменяемы при матчинге пула к выбранной CEX-паре. */
const USD_STABLE_CANONICAL = new Set(['USDC', 'USDT', 'DAI', 'BUSD'])

function isUsdStableSymbol(symbol: string): boolean {
  return USD_STABLE_CANONICAL.has(canonicalTokenSymbol(symbol))
}

function tokensEquivalent(a: string, b: string): boolean {
  const ca = canonicalTokenSymbol(a)
  const cb = canonicalTokenSymbol(b)
  if (ca === cb) return true
  return isUsdStableSymbol(ca) && isUsdStableSymbol(cb)
}

export interface ParsedPipeMarketKey {
  source: string
  pair: string
  field: string
  base: string
  quote: string
}

export interface DerivedDexPool {
  id: string
  network: string
  networkLabel: string
  pair: string
  label: string
  base: string
  quote: string
  baseSymbol: string
  quoteSymbol: string
}

export interface StoreMarketCatalog {
  keys: string[]
  /** Уникальные торговые пары в CEX-виде (BTC/USDT, ETH/USDC, …). */
  pairSymbols: string[]
  /** CEX source ids из ключей: binance, bybit, … */
  cexSourceIds: string[]
  /** DEX-сети из ключей. */
  dexNetworks: Array<{ id: string; name: string }>
  /** Уникальные DEX-пулы с человекочитаемыми символами. */
  dexPools: DerivedDexPool[]
}

function normalizeAddr(addr: string): string {
  return addr.trim().toLowerCase()
}

function shortAddress(addr: string): string {
  const a = addr.trim()
  if (a.length <= 12) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function tokenDisplayName(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return trimmed
  if (EVM_ADDRESS.test(trimmed)) {
    return DEX_TOKEN_NAMES[normalizeAddr(trimmed)] ?? shortAddress(trimmed)
  }
  return trimmed.toUpperCase()
}

/** Канонический символ для сопоставления с CEX-парой (WBTC/cbBTC→BTC, WETH→ETH). */
export function canonicalTokenSymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '')
  if (!raw) return raw
  if (SYMBOL_ALIASES[raw]) return SYMBOL_ALIASES[raw]

  // WETH / WBTC
  if (raw.startsWith('W') && raw.length > 1) {
    const unwrapped = raw.slice(1)
    if (SYMBOL_ALIASES[unwrapped]) return SYMBOL_ALIASES[unwrapped]
  }

  // cbBTC / cbETH → strip CB prefix
  if (raw.startsWith('CB') && raw.length > 2) {
    const unwrapped = raw.slice(2)
    if (SYMBOL_ALIASES[unwrapped]) return SYMBOL_ALIASES[unwrapped]
  }

  return raw
}

export function networkLabelFromId(networkId: string): string {
  const id = networkId.trim().toLowerCase()
  if (!id) return networkId
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/** Разбор ключа `source|PAIR|field` (pipe-формат arbiDexMarketData). */
export function parsePipeMarketKey(
  key: string,
  allowedFields: Set<string> = PRICE_FIELDS,
): ParsedPipeMarketKey | null {
  if (!key.includes('|')) return null
  const parts = key.split('|')
  if (parts.length < 3) return null

  const field = parts[parts.length - 1]
  if (!allowedFields.has(field)) return null

  const pair = parts[parts.length - 2]
  const slashIdx = pair.indexOf('/')
  if (slashIdx <= 0 || slashIdx === pair.length - 1) return null

  const source = parts.slice(0, -2).join('|')
  if (!source) return null

  return {
    source,
    pair,
    field,
    base: pair.slice(0, slashIdx),
    quote: pair.slice(slashIdx + 1),
  }
}

function isAddressToken(token: string): boolean {
  return EVM_ADDRESS.test(token.trim())
}

/**
 * Нормализует направление пула: нестабильный токен → base, стейбл → quote.
 * Для UI и матчинга к CEX-парам (BTC/USDT), даже если в store path наоборот.
 */
export function canonicalizeDexSides(
  tokenA: string,
  tokenB: string,
): { base: string; quote: string; baseSymbol: string; quoteSymbol: string } {
  const a = normalizeAddr(tokenA)
  const b = normalizeAddr(tokenB)
  const symA = tokenDisplayName(a)
  const symB = tokenDisplayName(b)
  const aStable = STABLE_SYMBOLS.has(symA.toUpperCase())
  const bStable = STABLE_SYMBOLS.has(symB.toUpperCase())

  if (aStable && !bStable) {
    return { base: b, quote: a, baseSymbol: symB, quoteSymbol: symA }
  }
  return { base: a, quote: b, baseSymbol: symA, quoteSymbol: symB }
}

/** CEX-style pair id from token symbols (WBTC/USDC → BTC/USDC). */
export function toCanonicalPairSymbol(baseSymbol: string, quoteSymbol: string): string {
  return `${canonicalTokenSymbol(baseSymbol)}/${canonicalTokenSymbol(quoteSymbol)}`
}

export function pairMatchesSelection(poolPair: string, selectedPair: string): boolean {
  const [pb, pq] = poolPair.split('/')
  const [sb, sq] = selectedPair.split('/')
  if (!pb || !pq || !sb || !sq) return false
  return (
    (tokensEquivalent(pb, sb) && tokensEquivalent(pq, sq)) ||
    (tokensEquivalent(pb, sq) && tokensEquivalent(pq, sb))
  )
}

/** Уникальные символы пар (только CEX-тикеры из ключей; DEX-адреса отфильтровываются). */
export function extractPairSymbolsFromKeys(keys: string[]): string[] {
  return deriveStoreMarketCatalog(keys).pairSymbols
}

export function deriveStoreMarketCatalog(keys: string[]): StoreMarketCatalog {
  const pairSymbols = new Set<string>()
  const cexSourceIds = new Set<string>()
  const dexNetworkIds = new Set<string>()
  const dexPoolMap = new Map<string, DerivedDexPool>()

  for (const key of keys) {
    if (typeof key !== 'string') continue
    const parsed = parsePipeMarketKey(key, POOL_DISCOVERY_FIELDS)
    if (!parsed) continue

    if (parsed.source.startsWith('dex:')) {
      const network = parsed.source.slice(4).trim().toLowerCase()
      if (!network) continue
      dexNetworkIds.add(network)

      if (!isAddressToken(parsed.base) || !isAddressToken(parsed.quote)) continue

      const sides = canonicalizeDexSides(parsed.base, parsed.quote)
      const pair = toCanonicalPairSymbol(sides.baseSymbol, sides.quoteSymbol)
      pairSymbols.add(pair)

      const poolKey = `${network}|${sides.base}|${sides.quote}`
      if (!dexPoolMap.has(poolKey)) {
        dexPoolMap.set(poolKey, {
          id: poolKey,
          network,
          networkLabel: networkLabelFromId(network),
          pair,
          label: `${sides.baseSymbol} / ${sides.quoteSymbol}`,
          base: sides.base,
          quote: sides.quote,
          baseSymbol: sides.baseSymbol,
          quoteSymbol: sides.quoteSymbol,
        })
      }
      continue
    }

    // CEX
    if (!isAddressToken(parsed.base) && !isAddressToken(parsed.quote)) {
      cexSourceIds.add(parsed.source.trim().toLowerCase())
      pairSymbols.add(toCanonicalPairSymbol(parsed.base, parsed.quote))
    }
  }

  const dexNetworks = [...dexNetworkIds]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, name: networkLabelFromId(id) }))

  const dexPools = [...dexPoolMap.values()].sort((a, b) =>
    a.network.localeCompare(b.network) || a.label.localeCompare(b.label),
  )

  return {
    keys: keys.filter((k): k is string => typeof k === 'string'),
    pairSymbols: [...pairSymbols].sort((a, b) => a.localeCompare(b)),
    cexSourceIds: [...cexSourceIds].sort((a, b) => a.localeCompare(b)),
    dexNetworks,
    dexPools,
  }
}

export function getDexPoolsForPair(
  catalog: StoreMarketCatalog,
  network: string,
  pair: string,
): DerivedDexPool[] {
  const net = network.trim().toLowerCase()
  return catalog.dexPools.filter(
    (p) => p.network === net && pairMatchesSelection(p.pair, pair),
  )
}
