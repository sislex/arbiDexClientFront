import type { DexTokenAddresses } from '../types/chart'
import { getDexPoolsForPair, type DerivedDexPool } from './parseMarketDataKeys'

export interface DexPoolPreset {
  id: string
  label: string
  pair: string
  base: string
  quote: string
}

/** Известные контракты по сетям (lowercase) — для резолва адресов в графиках/ботах. */
export const DEX_KNOWN_TOKENS: Record<string, Record<string, string>> = {
  arbitrum: {
    BTC: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    WBTC: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    ETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    USDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  },
  ethereum: {
    WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    BTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    ETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  optimism: {
    WETH: '0x4200000000000000000000000000000000000006',
    ETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    WBTC: '0x68f180fcce6836688e9084f035309e29bf0a2095',
    BTC: '0x68f180fcce6836688e9084f035309e29bf0a2095',
  },
  base: {
    WETH: '0x4200000000000000000000000000000000000006',
    ETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    CBBTC: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
    BTC: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
  },
  linea: {
    WETH: '0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f',
    ETH: '0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f',
    USDC: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff',
    USDT: '0xa219439258ca9da29e9cc4ce5596924745e12b93',
    WBTC: '0x3aab2285ddcddad8edf438c1bab47e1a9d05a9b4',
    BTC: '0x3aab2285ddcddad8edf438c1bab47e1a9d05a9b4',
  },
}

/** @deprecated пулы берутся из store/keys через deriveStoreMarketCatalog */
export const DEX_POOL_CATALOG: Array<DexPoolPreset & { network: string }> = []

const STABLE_QUOTE_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'USD', 'USDC.E', 'BUSD'])

function normalizeAddr(addr: string): string {
  return addr.trim().toLowerCase()
}

function dexPathCandidates(baseAddr: string, quoteAddr: string, pair: string): string[] {
  const b = normalizeAddr(baseAddr)
  const q = normalizeAddr(quoteAddr)
  const quoteSym = pair.split('/')[1]?.toUpperCase() ?? ''

  // В store API для */USDT котировка идёт первой: USDT_addr/WBTC_addr (см. /prices/key/…)
  if (STABLE_QUOTE_SYMBOLS.has(quoteSym)) {
    return [`${q}/${b}`, `${b}/${q}`]
  }

  return [`${b}/${q}`, `${q}/${b}`]
}

function dexKeyPair(network: string, path: string): { bidKey: string; askKey: string } {
  const net = network.trim().toLowerCase()
  return {
    bidKey: `dex:${net}|${path}|bidPrice`,
    askKey: `dex:${net}|${path}|askPrice`,
  }
}

export function defaultDexAddresses(network: string, pair: string): DexTokenAddresses | null {
  const [baseSym, quoteSym] = pair.split('/')
  if (!baseSym || !quoteSym) return null

  const tokens = DEX_KNOWN_TOKENS[network.trim().toLowerCase()]
  if (!tokens) return null

  const resolve = (sym: string): string | undefined => {
    const upper = sym.toUpperCase()
    return (
      tokens[sym] ??
      tokens[upper] ??
      tokens[`W${upper}`] ??
      tokens[`w${upper}`] ??
      (upper === 'BTC' ? tokens.WBTC ?? tokens.CBBTC ?? tokens.cbBTC : undefined) ??
      (upper === 'ETH' ? tokens.WETH : undefined)
    )
  }

  const base = resolve(baseSym)
  const quote = resolve(quoteSym)
  if (!base || !quote) return null

  return { base, quote }
}

export function shortTokenAddress(addr: string): string {
  const normalized = addr.trim()
  if (normalized.length <= 12) return normalized
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`
}

export function formatDexPoolOptionLabel(preset: DexPoolPreset): string {
  return `${preset.label} — ${shortTokenAddress(preset.base)} / ${shortTokenAddress(preset.quote)}`
}

export function dexPoolPresetValue(preset: Pick<DexPoolPreset, 'base' | 'quote'>): string {
  return `${normalizeAddr(preset.base)}|${normalizeAddr(preset.quote)}`
}

function toPoolPreset(pool: DerivedDexPool): DexPoolPreset {
  return {
    id: pool.id,
    label: pool.label,
    pair: pool.pair,
    base: pool.base,
    quote: pool.quote,
  }
}

/** Пулы из live store catalog (без захардкоженного списка). */
export function getDexPoolPresets(
  network: string,
  pair: string,
  livePools: DerivedDexPool[] = [],
): DexPoolPreset[] {
  if (livePools.length > 0) {
    return getDexPoolsForPair(
      {
        keys: [],
        pairSymbols: [],
        cexSourceIds: [],
        dexNetworks: [],
        dexPools: livePools,
      },
      network,
      pair,
    ).map(toPoolPreset)
  }
  return []
}

export function findDexPoolPreset(
  network: string,
  pair: string,
  addresses: DexTokenAddresses,
  livePools: DerivedDexPool[] = [],
): DexPoolPreset | null {
  const pools = getDexPoolPresets(network, pair, livePools)
  const base = normalizeAddr(addresses.base)
  const quote = normalizeAddr(addresses.quote)
  if (!base || !quote) return pools[0] ?? null

  return (
    pools.find((p) => normalizeAddr(p.base) === base && normalizeAddr(p.quote) === quote) ??
    pools[0] ??
    null
  )
}

/** Ищет bid/ask ключи в store с учётом символов пары (BTC/USDT → USDT/WBTC). */
export function resolveDexStoreKeysForPair(
  network: string,
  baseAddr: string,
  quoteAddr: string,
  pair: string,
  catalog: Set<string>,
): { bidKey: string; askKey: string; path: string } | null {
  const b = normalizeAddr(baseAddr)
  const q = normalizeAddr(quoteAddr)
  if (!b || !q) return null

  const seen = new Set<string>()
  for (const path of dexPathCandidates(baseAddr, quoteAddr, pair)) {
    if (seen.has(path)) continue
    seen.add(path)
    const keys = dexKeyPair(network, path)
    if (catalog.has(keys.bidKey) && catalog.has(keys.askKey)) {
      return { ...keys, path }
    }
  }

  return null
}

/** Ключи для запроса, даже если каталог недоступен (предпочтительный path). */
export function buildPreferredDexStoreKeys(
  network: string,
  baseAddr: string,
  quoteAddr: string,
  pair: string,
): { bidKey: string; askKey: string; path: string } {
  const path = dexPathCandidates(baseAddr, quoteAddr, pair)[0]
  return { ...dexKeyPair(network, path), path }
}

/** Подбор ключей из каталога по паре и сети, если адреса не заданы. */
export function findDexStoreKeysFromCatalog(
  network: string,
  pair: string,
  catalog: Set<string>,
): { bidKey: string; askKey: string; base: string; quote: string; path: string } | null {
  const defaults = defaultDexAddresses(network, pair)
  if (!defaults) return null

  const resolved = resolveDexStoreKeysForPair(network, defaults.base, defaults.quote, pair, catalog)
  if (!resolved) return null

  const [base, quote] = resolved.path.split('/')
  return { ...resolved, base, quote }
}
