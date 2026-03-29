/**
 * Маппинг sourceId + pairId → префикс источника и символ в PriceStore.
 *
 * Ключ PriceStore: `<sourcePrefix>|<symbol>|bidPrice` / `<sourcePrefix>|<symbol>|askPrice`
 *
 * Каждый CEX/DEX использует свой формат символа:
 * - binance: ETHUSDC (BASEQUOTE)
 * - mexc:    ETHUSDT (BASEQUOTE)
 * - bybit:   ETHUSDT (BASEQUOTE)
 * - okx:     ETH-USDT (BASE-QUOTE)
 * - kucoin:  ETH-USDT (BASE-QUOTE)
 * - gateio:  ETH_USDT (BASE_QUOTE)
 * - dex:arbitrum: WETH/USDC (BASE/QUOTE)
 */

export interface PriceKeyMapping {
  /** Префикс источника в PriceStore (например, 'binance', 'dex:arbitrum') */
  sourcePrefix: string;
  /** Символ пары в PriceStore (например, 'ETHUSDC', 'WETH/USDC') */
  symbol: string;
}

/**
 * Таблица маппинга: `sourceId::pairId` → PriceKeyMapping
 */
const MAPPING: Record<string, PriceKeyMapping> = {
  // ── Binance ──
  'cex_binance::USDC_WETH':  { sourcePrefix: 'binance', symbol: 'ETHUSDC' },
  'cex_binance::ETH_USDT':   { sourcePrefix: 'binance', symbol: 'ETHUSDT' },

  // ── MEXC ──
  'cex_mex::ETH_USDT':       { sourcePrefix: 'mexc', symbol: 'ETHUSDT' },
  'cex_mex::USDC_WETH':      { sourcePrefix: 'mexc', symbol: 'ETHUSDC' },

  // ── Bybit ──
  'cex_bybit::ETH_USDT':     { sourcePrefix: 'bybit', symbol: 'ETHUSDT' },
  'cex_bybit::USDC_WETH':    { sourcePrefix: 'bybit', symbol: 'ETHUSDC' },

  // ── OKX ──
  'cex_okx::ETH_USDT':       { sourcePrefix: 'okx', symbol: 'ETH-USDT' },
  'cex_okx::USDC_WETH':      { sourcePrefix: 'okx', symbol: 'ETH-USDC' },

  // ── KuCoin ──
  'cex_kucoin::ETH_USDT':    { sourcePrefix: 'kucoin', symbol: 'ETH-USDT' },
  'cex_kucoin::USDC_WETH':   { sourcePrefix: 'kucoin', symbol: 'ETH-USDC' },

  // ── Gate.io ──
  'cex_gateio::ETH_USDT':    { sourcePrefix: 'gateio', symbol: 'ETH_USDT' },
  'cex_gateio::USDC_WETH':   { sourcePrefix: 'gateio', symbol: 'ETH_USDC' },

  // ── DEX Arbitrum ──
  'dex_arbitrum::USDC_WETH':  { sourcePrefix: 'dex:arbitrum', symbol: 'WETH/USDC' },
};

/**
 * Получить PriceStore-ключи (bid + ask) для пары sourceId + pairId.
 * Возвращает null если маппинг не найден.
 */
export function getPriceStoreKeys(
  sourceId: string,
  pairId: string,
): { bidKey: string; askKey: string; mapping: PriceKeyMapping } | null {
  const m = MAPPING[`${sourceId}::${pairId}`];
  if (!m) return null;
  return {
    bidKey: `${m.sourcePrefix}|${m.symbol}|bidPrice`,
    askKey: `${m.sourcePrefix}|${m.symbol}|askPrice`,
    mapping: m,
  };
}

