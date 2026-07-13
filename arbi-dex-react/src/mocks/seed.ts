import type { Bot, Market, MarketConfig, StrategyConfig } from '../domain/types';
import { defaultStrategySides } from '../domain/conditionsCatalog';

/** Fixed reference "now" so mock series & stories stay reproducible. 2026-07-08. */
export const NOW = 1783555200;

export const MARKETS: Market[] = [
  { id: 'binance_eth_usdt', sourceId: 'cex_binance', sourceName: 'Binance', kind: 'cex', pairId: 'ETH_USDT', base: 'ETH', quote: 'USDT' },
  { id: 'coinbase_eth_usdt', sourceId: 'cex_coinbase', sourceName: 'Coinbase', kind: 'cex', pairId: 'ETH_USDT', base: 'ETH', quote: 'USDT' },
  { id: 'kraken_eth_usdt', sourceId: 'cex_kraken', sourceName: 'Kraken', kind: 'cex', pairId: 'ETH_USDT', base: 'ETH', quote: 'USDT' },
  { id: 'uniswap_weth_usdc', sourceId: 'dex_uniswap_v3', sourceName: 'Uniswap v3', kind: 'dex', pairId: 'WETH_USDC', base: 'WETH', quote: 'USDC' },
  { id: 'binance_btc_usdt', sourceId: 'cex_binance', sourceName: 'Binance', kind: 'cex', pairId: 'BTC_USDT', base: 'BTC', quote: 'USDT' },
  { id: 'coinbase_btc_usdt', sourceId: 'cex_coinbase', sourceName: 'Coinbase', kind: 'cex', pairId: 'BTC_USDT', base: 'BTC', quote: 'USDT' },
  { id: 'uniswap_wbtc_usdc', sourceId: 'dex_uniswap_v3', sourceName: 'Uniswap v3', kind: 'dex', pairId: 'WBTC_USDC', base: 'WBTC', quote: 'USDC' },
];

export const MARKET_CONFIGS: MarketConfig[] = [
  {
    id: 'mc_eth',
    name: 'ETH — Uniswap vs CEX',
    tradingMarketId: 'uniswap_weth_usdc',
    observedMarketIds: ['binance_eth_usdt', 'coinbase_eth_usdt', 'kraken_eth_usdt'],
    useWeightedAverage: true,
    weights: { binance_eth_usdt: 0.5, coinbase_eth_usdt: 0.3, kraken_eth_usdt: 0.2 },
    createdAt: '2026-06-20T10:00:00Z',
  },
  {
    id: 'mc_btc',
    name: 'BTC — Uniswap vs CEX',
    tradingMarketId: 'uniswap_wbtc_usdc',
    observedMarketIds: ['binance_btc_usdt', 'coinbase_btc_usdt'],
    useWeightedAverage: true,
    weights: {},
    createdAt: '2026-06-25T12:30:00Z',
  },
];

function strat(id: string, name: string, tweaks?: (s: StrategyConfig) => void): StrategyConfig {
  const sides = defaultStrategySides();
  const s: StrategyConfig = { id, name, buy: sides.buy, sell: sides.sell, createdAt: '2026-06-21T09:00:00Z' };
  tweaks?.(s);
  return s;
}

export const STRATEGY_CONFIGS: StrategyConfig[] = [
  strat('st_conservative', 'Консервативная (0.5% / стоп-2%)'),
  strat('st_aggressive', 'Агрессивная (0.3% / трейлинг-1%)', (s) => {
    const b = s.buy.find((c) => c.conditionId === 'avg_observed_higher_for_last_steps');
    if (b) b.params.percent = 0.3;
    const sl = s.sell.find((c) => c.conditionId === 'avg_observed_higher_for_last_steps');
    if (sl) sl.params.percent = 0.3;
  }),
];

export const BOTS: Bot[] = [
  {
    id: 'bot_1',
    name: 'ETH Arb #1',
    status: 'running',
    mode: 'demo-live',
    marketConfigId: 'mc_eth',
    strategyConfigId: 'st_conservative',
    baseAsset: 'WETH',
    quoteAsset: 'USDC',
    initialBalance: 1000,
    balance: 1084.32,
    pnl: 84.32,
    pnlPct: 8.43,
    tradesCount: 42,
    winRate: 61.9,
    openPosition: true,
    createdAt: '2026-06-22T08:00:00Z',
    updatedAt: '2026-07-08T06:00:00Z',
  },
  {
    id: 'bot_2',
    name: 'ETH Arb #2 (real)',
    status: 'running',
    mode: 'real-live',
    marketConfigId: 'mc_eth',
    strategyConfigId: 'st_aggressive',
    baseAsset: 'WETH',
    quoteAsset: 'USDC',
    initialBalance: 2000,
    balance: 1972.5,
    pnl: -27.5,
    pnlPct: -1.38,
    tradesCount: 88,
    winRate: 48.9,
    openPosition: false,
    createdAt: '2026-06-28T14:00:00Z',
    updatedAt: '2026-07-08T05:40:00Z',
  },
  {
    id: 'bot_3',
    name: 'BTC Arb',
    status: 'paused',
    mode: 'demo-live',
    marketConfigId: 'mc_btc',
    strategyConfigId: 'st_conservative',
    baseAsset: 'WBTC',
    quoteAsset: 'USDC',
    initialBalance: 5000,
    balance: 5321.9,
    pnl: 321.9,
    pnlPct: 6.44,
    tradesCount: 27,
    winRate: 66.7,
    openPosition: false,
    createdAt: '2026-07-01T11:00:00Z',
    updatedAt: '2026-07-07T22:10:00Z',
  },
  {
    id: 'bot_4',
    name: 'BTC Scalper',
    status: 'stopped',
    mode: 'idle',
    marketConfigId: 'mc_btc',
    strategyConfigId: 'st_aggressive',
    baseAsset: 'WBTC',
    quoteAsset: 'USDC',
    initialBalance: 3000,
    balance: 3000,
    pnl: 0,
    pnlPct: 0,
    tradesCount: 0,
    winRate: 0,
    openPosition: false,
    createdAt: '2026-07-06T09:00:00Z',
    updatedAt: '2026-07-06T09:00:00Z',
  },
];

/** Base price per pair for quote-series generation. */
export const PAIR_BASE_PRICE: Record<string, number> = {
  ETH_USDT: 3200,
  WETH_USDC: 3200,
  BTC_USDT: 62000,
  WBTC_USDC: 62000,
};
