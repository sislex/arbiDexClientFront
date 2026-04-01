/**
 * Утилиты для разбора ключей arbiDexMarketData.
 *
 * Реальный формат ключей (без разделителей между частями):
 *   `{source}{base/quote}{field}`
 *
 * Примеры:
 *   `mexcETH/USDTbidPrice`       → source=mexc,  pair=ETH/USDT, field=bidPrice
 *   `binanceETH/USDCaskPrice`    → source=binance, pair=ETH/USDC, field=askPrice
 *   `dex:arbitrum0x82af…/0xaf88…bidPrice` → source=dex:arbitrum, pair=0x82af…/0xaf88…, field=bidPrice
 *
 * Также поддерживается формат с `|` разделителем:
 *   `mexc|ETH/USDT|bidPrice`     → source=mexc, pair=ETH/USDT, field=bidPrice
 */

/** Результат разбора ключа */
export interface ParsedMarketKey {
  /** Источник: 'mexc', 'binance', 'dex:arbitrum', … */
  source: string;
  /** Базовая валюта/токен: 'ETH', '0x82af…' */
  base: string;
  /** Котируемая валюта/токен: 'USDT', '0xaf88…' */
  quote: string;
  /** Поле: 'bidPrice' | 'askPrice' */
  field: 'bidPrice' | 'askPrice';
}

/** Маппинг адреса контракта → человекочитаемое символ */
const TOKEN_NAMES: Record<string, string> = {
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'WETH',
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USDC',
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 'USDC.e',
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'USDT',
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 'WBTC',
  '0x912ce59144191c1204e64559fe8253a0e49e6548': 'ARB',
};

/** Маппинг источника → метаданные для каталога */
export const SOURCE_META: Record<string, { displayName: string; type: 'dex' | 'cex' }> = {
  'dex:arbitrum': { displayName: 'Arbitrum DEX', type: 'dex' },
  'binance':      { displayName: 'Binance',      type: 'cex' },
  'mexc':         { displayName: 'MEXC',          type: 'cex' },
  'bybit':        { displayName: 'Bybit',         type: 'cex' },
  'okx':          { displayName: 'OKX',           type: 'cex' },
  'kucoin':       { displayName: 'KuCoin',        type: 'cex' },
  'gateio':       { displayName: 'Gate.io',       type: 'cex' },
};

/** Известные префиксы источников, отсортированные по длине (longest first) */
const KNOWN_SOURCES_SORTED = Object.keys(SOURCE_META).sort((a, b) => b.length - a.length);

/**
 * Разбирает ключ arbiDexMarketData.
 *
 * Поддерживает два формата:
 *   1. С `|`:  `source|pair|field`   — напр. `mexc|ETH/USDT|bidPrice`
 *   2. Без:    `sourcePairField`     — напр. `mexcETH/USDTbidPrice`
 *
 * Пара всегда содержит `/` внутри (ETH/USDT, 0x…/0x…).
 */
export function parseMarketDataKey(key: string): ParsedMarketKey | null {
  // ── Формат с `|` разделителем: source|pair|field ──
  if (key.includes('|')) {
    const parts = key.split('|');
    if (parts.length === 3) {
      const [source, pair, field] = parts;
      if (field !== 'bidPrice' && field !== 'askPrice') return null;
      const slashIdx = pair.indexOf('/');
      if (slashIdx < 0) return null;
      return {
        source,
        base: pair.slice(0, slashIdx),
        quote: pair.slice(slashIdx + 1),
        field,
      };
    }
    return null;
  }

  // ── Формат без разделителей: sourcePairField ──
  let field: 'bidPrice' | 'askPrice';
  let rest: string;

  if (key.endsWith('bidPrice')) {
    field = 'bidPrice';
    rest = key.slice(0, -8); // 'bidPrice'.length === 8
  } else if (key.endsWith('askPrice')) {
    field = 'askPrice';
    rest = key.slice(0, -8);
  } else {
    return null;
  }

  // Ищем известный источник (longest prefix first)
  for (const src of KNOWN_SOURCES_SORTED) {
    if (rest.startsWith(src)) {
      const pair = rest.slice(src.length); // 'ETH/USDT' или '0x…/0x…'
      const slashIdx = pair.indexOf('/');
      if (slashIdx < 0) return null;
      return {
        source: src,
        base: pair.slice(0, slashIdx),
        quote: pair.slice(slashIdx + 1),
        field,
      };
    }
  }

  return null;
}

/**
 * Преобразует адрес токена в человекочитаемое имя.
 * Если адрес неизвестен — возвращает укороченный адрес.
 */
export function tokenDisplayName(token: string): string {
  return TOKEN_NAMES[token.toLowerCase()] ?? token;
}

/**
 * Генерирует pairId из base и quote.
 * Для адресов использует человекочитаемые имена.
 * Пример: ('ETH', 'USDT') → 'ETH_USDT';  ('0x82af…', '0xaf88…') → 'WETH_USDC'
 */
export function makePairId(base: string, quote: string): string {
  const b = TOKEN_NAMES[base.toLowerCase()] ?? base;
  const q = TOKEN_NAMES[quote.toLowerCase()] ?? quote;
  return `${b}_${q}`;
}

/**
 * Генерирует displayName пары из base и quote.
 */
export function makePairDisplayName(base: string, quote: string): string {
  const b = TOKEN_NAMES[base.toLowerCase()] ?? base;
  const q = TOKEN_NAMES[quote.toLowerCase()] ?? quote;
  return `${b}/${q}`;
}

/**
 * Определяет формат ключей по массиву ключей.
 */
export function detectKeyFormat(keys: string[]): 'pipe' | 'concat' {
  return keys.some((k) => k.includes('|')) ? 'pipe' : 'concat';
}

/**
 * Генерирует ключи arbiDexMarketData (bid + ask) для данного sourceId + pairId.
 *
 * @param sourceId  напр. 'mexc', 'dex:arbitrum'
 * @param pairId    напр. 'ETH_USDT', 'WETH_USDC'
 * @param format    'pipe' → 'mexc|ETH/USDT|bidPrice'; 'concat' → 'mexcETH/USDTbidPrice'
 */
export function buildStoreKeys(
  sourceId: string,
  pairId: string,
  format: 'pipe' | 'concat' = 'concat',
): { bidKey: string; askKey: string } | null {
  const parts = pairId.split('_');
  if (parts.length !== 2) return null;

  const [baseDisplay, quoteDisplay] = parts;

  // Обратный маппинг: символ → адрес (для DEX)
  const reverseTokens: Record<string, string> = {};
  for (const [addr, name] of Object.entries(TOKEN_NAMES)) {
    reverseTokens[name] = addr;
  }

  // Для DEX подставляем адреса, для CEX используем символы как есть
  const base = sourceId.startsWith('dex:') ? (reverseTokens[baseDisplay] ?? baseDisplay) : baseDisplay;
  const quote = sourceId.startsWith('dex:') ? (reverseTokens[quoteDisplay] ?? quoteDisplay) : quoteDisplay;

  const pair = `${base}/${quote}`;

  if (format === 'pipe') {
    return {
      bidKey: `${sourceId}|${pair}|bidPrice`,
      askKey: `${sourceId}|${pair}|askPrice`,
    };
  }

  return {
    bidKey: `${sourceId}${pair}bidPrice`,
    askKey: `${sourceId}${pair}askPrice`,
  };
}
