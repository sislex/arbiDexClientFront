import { Source } from '../models';

export const MOCK_SOURCES: Source[] = [
  {
    id: 'dex_arbitrum',
    name: 'dex_arbitrum',
    displayName: 'Arbitrum DEX',
    type: 'dex',
    isActive: true,
  },
  {
    id: 'cex_binance',
    name: 'cex_binance',
    displayName: 'Binance',
    type: 'cex',
    isActive: true,
  },
  {
    id: 'cex_mex',
    name: 'cex_mex',
    displayName: 'MEXC',
    type: 'cex',
    isActive: true,
  },
  {
    id: 'cex_bybit',
    name: 'cex_bybit',
    displayName: 'Bybit',
    type: 'cex',
    isActive: true,
  },
];

