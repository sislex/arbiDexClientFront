import { Quote } from '../models';

const now = Date.now();

function makeQuote(
  sourceId: string,
  pairId: string,
  mid: number,
  spreadPct: number,
  offsetMs = 0,
): Quote {
  const half = mid * (spreadPct / 2);
  const bid = mid - half;
  const ask = mid + half;
  return {
    sourceId,
    pairId,
    bid: +bid.toFixed(6),
    ask: +ask.toFixed(6),
    mid: +mid.toFixed(6),
    spread: +(ask - bid).toFixed(6),
    spreadPct,
    timestamp: now - offsetMs,
  };
}

export const MOCK_QUOTES: Quote[] = [
  // dex_arbitrum
  makeQuote('dex_arbitrum', 'USDC_WETH', 0.000415,   0.0030, 1000),
  makeQuote('dex_arbitrum', 'ARB_WBTC',  0.0000082,  0.0050, 1200),
  makeQuote('dex_arbitrum', 'ETH_USDT',  3412.50,    0.0020, 800),
  makeQuote('dex_arbitrum', 'WBTC_USDC', 67250.00,   0.0025, 900),

  // cex_binance
  makeQuote('cex_binance',  'USDC_WETH', 0.000416,   0.0010, 500),
  makeQuote('cex_binance',  'ARB_WBTC',  0.0000083,  0.0015, 600),
  makeQuote('cex_binance',  'ETH_USDT',  3415.00,    0.0008, 400),
  makeQuote('cex_binance',  'WBTC_USDC', 67280.00,   0.0010, 450),

  // cex_mex
  makeQuote('cex_mex',      'USDC_WETH', 0.000414,   0.0012, 700),
  makeQuote('cex_mex',      'ARB_WBTC',  0.0000081,  0.0018, 750),
  makeQuote('cex_mex',      'ETH_USDT',  3410.75,    0.0009, 650),
  makeQuote('cex_mex',      'WBTC_USDC', 67230.00,   0.0012, 700),

  // cex_bybit
  makeQuote('cex_bybit',    'USDC_WETH', 0.000417,   0.0011, 300),
  makeQuote('cex_bybit',    'ARB_WBTC',  0.0000084,  0.0016, 350),
  makeQuote('cex_bybit',    'ETH_USDT',  3416.25,    0.0007, 200),
  makeQuote('cex_bybit',    'WBTC_USDC', 67295.00,   0.0009, 250),
];

