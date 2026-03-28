import { TradingPair } from '../models';

export const MOCK_PAIRS: TradingPair[] = [
  { id: 'USDC_WETH', base: 'USDC', quote: 'WETH', displayName: 'USDC/WETH' },
  { id: 'ARB_WBTC',  base: 'ARB',  quote: 'WBTC', displayName: 'ARB/WBTC'  },
  { id: 'ETH_USDT',  base: 'ETH',  quote: 'USDT', displayName: 'ETH/USDT'  },
  { id: 'WBTC_USDC', base: 'WBTC', quote: 'USDC', displayName: 'WBTC/USDC' },
];

