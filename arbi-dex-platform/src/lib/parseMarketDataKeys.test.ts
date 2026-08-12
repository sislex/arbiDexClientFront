import { describe, expect, it } from 'vitest'
import {
  canonicalizeDexSides,
  deriveStoreMarketCatalog,
  getDexPoolsForPair,
  pairMatchesSelection,
  tokenDisplayName,
  toCanonicalPairSymbol,
} from './parseMarketDataKeys'

const SAMPLE_KEYS = [
  'binance|BTC/USDT|bidPrice',
  'binance|BTC/USDT|askPrice',
  'bybit|ETH/USDC|bidPrice',
  'bybit|ETH/USDC|askPrice',
  'dex:arbitrum|0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f/0xaf88d065e77c8cc2239327c5edb3a432268e5831|bidPrice',
  'dex:arbitrum|0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f/0xaf88d065e77c8cc2239327c5edb3a432268e5831|askPrice',
  // reverse path — same pool after canonicalize
  'dex:arbitrum|0xaf88d065e77c8cc2239327c5edb3a432268e5831/0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f|bidPrice',
  'dex:arbitrum|0x82af49447d8a07e3bd95bd0d56f35241523fbab1/0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9|bidPrice',
  'dex:base|0x4200000000000000000000000000000000000006/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913|bidPrice',
]

describe('tokenDisplayName', () => {
  it('maps known addresses to symbols', () => {
    expect(tokenDisplayName('0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f')).toBe('WBTC')
    expect(tokenDisplayName('0xaf88d065e77c8cc2239327c5edb3a432268e5831')).toBe('USDC')
  })
})

describe('canonicalizeDexSides', () => {
  it('puts non-stable first when store path is stable/base', () => {
    const sides = canonicalizeDexSides(
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    )
    expect(sides.baseSymbol).toBe('WBTC')
    expect(sides.quoteSymbol).toBe('USDC')
  })
})

describe('deriveStoreMarketCatalog', () => {
  it('builds unique CEX+DEX pairs with human-readable DEX pools', () => {
    const catalog = deriveStoreMarketCatalog(SAMPLE_KEYS)

    expect(catalog.pairSymbols).toEqual(['BTC/USDC', 'BTC/USDT', 'ETH/USDC', 'ETH/USDT'])
    expect(catalog.cexSourceIds).toEqual(['binance', 'bybit'])
    expect(catalog.dexNetworks.map((n) => n.id)).toEqual(['arbitrum', 'base'])

    const arbBtcUsdc = catalog.dexPools.filter(
      (p) => p.network === 'arbitrum' && p.pair === 'BTC/USDC',
    )
    expect(arbBtcUsdc).toHaveLength(1)
    expect(arbBtcUsdc[0]?.label).toBe('WBTC / USDC')
    expect(arbBtcUsdc[0]?.baseSymbol).toBe('WBTC')
  })

  it('filters pools by selected CEX pair via aliases', () => {
    const catalog = deriveStoreMarketCatalog(SAMPLE_KEYS)
    const pools = getDexPoolsForPair(catalog, 'Arbitrum', 'BTC/USDC')
    expect(pools).toHaveLength(1)
    expect(pools[0]?.label).toBe('WBTC / USDC')
  })
})

describe('pairMatchesSelection', () => {
  it('matches WBTC / cbBTC / BTC as the same base', () => {
    expect(toCanonicalPairSymbol('WBTC', 'USDC')).toBe('BTC/USDC')
    expect(toCanonicalPairSymbol('cbBTC', 'USDC')).toBe('BTC/USDC')
    expect(toCanonicalPairSymbol('BTC', 'USDC')).toBe('BTC/USDC')
    expect(pairMatchesSelection('BTC/USDC', 'BTC/USDC')).toBe(true)
    expect(pairMatchesSelection(toCanonicalPairSymbol('WBTC', 'USDT'), 'BTC/USDT')).toBe(true)
  })

  it('matches WETH / ETH as the same base', () => {
    expect(toCanonicalPairSymbol('WETH', 'USDT')).toBe('ETH/USDT')
    expect(toCanonicalPairSymbol('ETH', 'USDT')).toBe('ETH/USDT')
    expect(pairMatchesSelection(toCanonicalPairSymbol('WETH', 'USDC'), 'ETH/USDC')).toBe(true)
  })

  it('treats USDB as USDC/USDT stable', () => {
    expect(toCanonicalPairSymbol('WETH', 'USDB')).toBe('ETH/USDC')
    expect(pairMatchesSelection('ETH/USDC', 'ETH/USDT')).toBe(true)
    expect(pairMatchesSelection('ETH/USDC', 'ETH/USDC')).toBe(true)
    expect(pairMatchesSelection(toCanonicalPairSymbol('WETH', 'USDB'), 'ETH/USDT')).toBe(true)
  })
})

describe('cbBTC pool aliases', () => {
  it('treats base cbBTC pool as BTC/USDC', () => {
    const catalog = deriveStoreMarketCatalog([
      ...SAMPLE_KEYS,
      'dex:base|0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913|bidPrice',
    ])
    const pools = getDexPoolsForPair(catalog, 'Base', 'BTC/USDC')
    expect(pools.some((p) => p.baseSymbol === 'cbBTC')).toBe(true)
    expect(pools.every((p) => p.pair === 'BTC/USDC')).toBe(true)
  })
})

describe('Linea USDT/WETH pool', () => {
  it('maps Linea 0xA219… as USDT not WBTC', () => {
    const catalog = deriveStoreMarketCatalog([
      'dex:linea|0x176211869cA2b568f2A7D4EE941E073a821EE1ff/0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f|bidPrice',
      'dex:linea|0xA219439258ca9da29E9Cc4cE5596924745e12B93/0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f|bidPrice',
    ])
    expect(catalog.dexNetworks.map((n) => n.id)).toContain('linea')
    expect(catalog.pairSymbols).toEqual(['ETH/USDC', 'ETH/USDT'])

    const usdtPools = getDexPoolsForPair(catalog, 'Linea', 'ETH/USDT')
    expect(usdtPools.some((p) => p.label === 'WETH / USDT')).toBe(true)
    expect(usdtPools.some((p) => p.label === 'WETH / USDC')).toBe(true) // USD stables match
  })
})
