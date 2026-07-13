import { Market } from './types';

/** Sources mirror the seeded catalog (`src/database/seed.ts`). */
const SOURCES: { id: string; name: string; kind: 'cex' | 'dex' }[] = [
  { id: 'dex_arbitrum', name: 'Arbitrum DEX', kind: 'dex' },
  { id: 'cex_binance', name: 'Binance', kind: 'cex' },
  { id: 'cex_mex', name: 'MEXC', kind: 'cex' },
  { id: 'cex_bybit', name: 'Bybit', kind: 'cex' },
  { id: 'cex_okx', name: 'OKX', kind: 'cex' },
  { id: 'cex_kucoin', name: 'KuCoin', kind: 'cex' },
  { id: 'cex_gateio', name: 'Gate.io', kind: 'cex' },
];

/** Pairs mirror the seeded catalog. */
const PAIRS: { id: string; base: string; quote: string }[] = [
  { id: 'WETH_USDC', base: 'WETH', quote: 'USDC' },
  { id: 'ETH_USDT', base: 'ETH', quote: 'USDT' },
  { id: 'WBTC_USDC', base: 'WBTC', quote: 'USDC' },
  { id: 'ARB_WBTC', base: 'ARB', quote: 'WBTC' },
];

/** Base price per pair for quote-series generation. */
export const PAIR_BASE_PRICE: Record<string, number> = {
  WETH_USDC: 3200,
  ETH_USDT: 3200,
  WBTC_USDC: 62000,
  ARB_WBTC: 0.0000175,
};

export function basePriceForPair(pairId: string): number {
  return PAIR_BASE_PRICE[pairId] ?? 100;
}

/** Curated markets = sources × pairs. Id `${sourceId}__${pairId}`. */
export const MARKETS: Market[] = SOURCES.flatMap((s) =>
  PAIRS.map((p) => ({
    id: `${s.id}__${p.id}`,
    sourceId: s.id,
    sourceName: s.name,
    kind: s.kind,
    pairId: p.id,
    base: p.base,
    quote: p.quote,
  })),
);

export function findMarket(id: string): Market | undefined {
  return MARKETS.find((m) => m.id === id);
}

/** Fixed reference "now" (2026-07-08) so mock series stay reproducible. */
export const NOW = 1783555200;
