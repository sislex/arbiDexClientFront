/**
 * Известные токены сети Arbitrum: символ → адрес контракта и decimals.
 * Используется для построения ключей arbiDexMarketData (bidPool/askPool)
 * и подготовки payload реального свопа.
 */

export interface TokenMeta {
  /** Адрес контракта (lowercase) */
  address: string;
  /** Количество десятичных знаков токена */
  decimals: number;
}

/** Маппинг символ токена → метаданные (адрес + decimals) */
export const ARBITRUM_TOKENS: Record<string, TokenMeta> = {
  WETH:   { address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', decimals: 18 },
  USDC:   { address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', decimals: 6 },
  'USDC.e': { address: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', decimals: 6 },
  USDT:   { address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', decimals: 6 },
  WBTC:   { address: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f', decimals: 8 },
  ARB:    { address: '0x912ce59144191c1204e64559fe8253a0e49e6548', decimals: 18 },
};

/** Возвращает метаданные токена по символу (регистронезависимо). */
export function getTokenMeta(symbol: string): TokenMeta | undefined {
  return ARBITRUM_TOKENS[symbol] ?? ARBITRUM_TOKENS[symbol.toUpperCase()];
}
