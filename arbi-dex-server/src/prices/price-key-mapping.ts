/**
 * Маппинг sourceId + pairId → префикс источника и символ в arbiDexMarketData.
 *
 * Ключ в arbiDexMarketData: `<sourcePrefix><symbol>bidPrice` / `<sourcePrefix><symbol>askPrice`
 * (без разделителей — ключи конкатенированы напрямую).
 *
 * Каждый CEX/DEX использует свой формат символа:
 * - binance: ETHUSDC (BASEQUOTE)
 * - mexc:    ETHUSDT (BASEQUOTE)
 * - bybit:   ETHUSDT (BASEQUOTE)
 * - okx:     ETHUSDT (BASEQUOTE)
 * - kucoin:  ETHUSDT (BASEQUOTE)
 * - gateio:  ETHUSDT (BASEQUOTE)
 * - dex:arbitrum: <tokenAddress0><tokenAddress1> (контракты токенов)
 */

export interface PriceKeyMapping {
  /** Префикс источника в arbiDexMarketData (например, 'binance', 'dex:arbitrum') */
  sourcePrefix: string;
  /** Символ пары в arbiDexMarketData (например, 'ETHUSDC', '0x82af...0xaf88...') */
  symbol: string;
}

/** Контракты токенов на Arbitrum */
const ARBITRUM_WETH = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const ARBITRUM_USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

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
  'cex_okx::ETH_USDT':       { sourcePrefix: 'okx', symbol: 'ETHUSDT' },
  'cex_okx::USDC_WETH':      { sourcePrefix: 'okx', symbol: 'ETHUSDC' },

  // ── KuCoin ──
  'cex_kucoin::ETH_USDT':    { sourcePrefix: 'kucoin', symbol: 'ETHUSDT' },
  'cex_kucoin::USDC_WETH':   { sourcePrefix: 'kucoin', symbol: 'ETHUSDC' },

  // ── Gate.io ──
  'cex_gateio::ETH_USDT':    { sourcePrefix: 'gateio', symbol: 'ETHUSDT' },
  'cex_gateio::USDC_WETH':   { sourcePrefix: 'gateio', symbol: 'ETHUSDC' },

  // ── DEX Arbitrum ──
  'dex_arbitrum::USDC_WETH':  { sourcePrefix: 'dex:arbitrum', symbol: `${ARBITRUM_WETH}${ARBITRUM_USDC}` },
};

/**
 * Получить ключи arbiDexMarketData (bid + ask) для пары sourceId + pairId.
 * Возвращает null если маппинг не найден.
 */
export function getPriceStoreKeys(
  sourceId: string,
  pairId: string,
): { bidKey: string; askKey: string; mapping: PriceKeyMapping } | null {
  const m = MAPPING[`${sourceId}::${pairId}`];
  if (!m) return null;
  return {
    bidKey: `${m.sourcePrefix}${m.symbol}bidPrice`,
    askKey: `${m.sourcePrefix}${m.symbol}askPrice`,
    mapping: m,
  };
}

/**
 * Обратный маппинг: ключ arbiDexMarketData (без суффикса bidPrice/askPrice) → { sourceId, pairId }
 * Используется для построения таблицы Latest Quotes из snapshot.
 */
const REVERSE_MAPPING: Record<string, { sourceId: string; pairId: string }> = {};
for (const [compositeKey, mapping] of Object.entries(MAPPING)) {
  const [sourceId, pairId] = compositeKey.split('::');
  const storePrefix = `${mapping.sourcePrefix}${mapping.symbol}`;
  REVERSE_MAPPING[storePrefix] = { sourceId, pairId };
}

/** Известные префиксы источников, отсортированные по длине (longest first) */
const KNOWN_SOURCES = [
  'dex:arbitrum', 'binance', 'kucoin', 'gateio', 'bybit', 'mexc', 'okx',
];

/**
 * Разбирает ключ arbiDexMarketData на составляющие.
 * Например: `mexcETHUSDTbidPrice` → { source: 'mexc', symbol: 'ETHUSDT', field: 'bidPrice', sourceId: 'cex_mex', pairId: 'ETH_USDT' }
 * Возвращает null если ключ не удалось разобрать.
 */
export function parseStoreKey(key: string): {
  source: string;
  symbol: string;
  field: 'bidPrice' | 'askPrice';
  sourceId: string | null;
  pairId: string | null;
} | null {
  let field: 'bidPrice' | 'askPrice';
  let rest: string;

  if (key.endsWith('bidPrice')) {
    field = 'bidPrice';
    rest = key.slice(0, -8);
  } else if (key.endsWith('askPrice')) {
    field = 'askPrice';
    rest = key.slice(0, -8);
  } else {
    return null;
  }

  // Ищем известный источник (longest match first)
  for (const src of KNOWN_SOURCES) {
    if (rest.startsWith(src)) {
      const symbol = rest.slice(src.length);
      const reverse = REVERSE_MAPPING[`${src}${symbol}`];
      return {
        source: src,
        symbol,
        field,
        sourceId: reverse?.sourceId ?? null,
        pairId: reverse?.pairId ?? null,
      };
    }
  }

  return null;
}
