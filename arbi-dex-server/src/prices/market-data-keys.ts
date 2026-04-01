/**
 * Утилиты для разбора ключей arbiDexMarketData.
 *
 * Поддерживает два формата ключей:
 * 1. С разделителем `|`:  `source|base|quote|field`  (напр. `mexc|ETH|USDT|bidPrice`)
 * 2. Без разделителей:    `sourceSymbolField`         (напр. `mexcETHUSDTbidPrice`)
 */

/** Результат разбора ключа */
export interface ParsedMarketKey {
  /** Источник: 'mexc', 'binance', 'dex:arbitrum', ... */
  source: string;
  /** Базовая валюта/токен: 'ETH', '0x82af...' */
  base: string;
  /** Котируемая валюта/токен: 'USDT', '0xaf88...' */
  quote: string;
  /** Поле: 'bidPrice' | 'askPrice' */
  field: 'bidPrice' | 'askPrice';
}

/** Маппинг адреса контракта → человекочитаемый символ */
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

/** Известные символы CEX (для формата без разделителей) */
const KNOWN_SYMBOLS = ['ETHUSDT', 'ETHUSDC', 'BTCUSDT', 'BTCUSDC'];

/** Маппинг символа CEX → { base, quote } (для формата без разделителей) */
const SYMBOL_SPLIT: Record<string, { base: string; quote: string }> = {
  'ETHUSDT': { base: 'ETH', quote: 'USDT' },
  'ETHUSDC': { base: 'ETH', quote: 'USDC' },
  'BTCUSDT': { base: 'BTC', quote: 'USDT' },
  'BTCUSDC': { base: 'BTC', quote: 'USDC' },
};

/**
 * Разбирает ключ arbiDexMarketData в любом формате.
 * Возвращает null если ключ не удалось разобрать.
 */
export function parseMarketDataKey(key: string): ParsedMarketKey | null {
  // ── Формат с разделителем `|` ──
  if (key.includes('|')) {
    const parts = key.split('|');
    // source|base|quote|field — 4 части
    if (parts.length === 4) {
      const field = parts[3];
      if (field !== 'bidPrice' && field !== 'askPrice') return null;
      return { source: parts[0], base: parts[1], quote: parts[2], field };
    }
    return null;
  }

  // ── Формат без разделителей ──
  let field: 'bidPrice' | 'askPrice';
  let rest: string;

  if (key.endsWith('bidPrice')) {
    field = 'bidPrice';
    rest = key.slice(0, -8); // 'bidPrice'.length = 8
  } else if (key.endsWith('askPrice')) {
    field = 'askPrice';
    rest = key.slice(0, -8);
  } else {
    return null;
  }

  for (const src of KNOWN_SOURCES_SORTED) {
    if (rest.startsWith(src)) {
      const symbolPart = rest.slice(src.length);

      // Для DEX — ищем адреса контрактов (0x... + 0x...)
      if (src.startsWith('dex:')) {
        const addrMatch = symbolPart.match(/^(0x[0-9a-f]{40})(0x[0-9a-f]{40})$/i);
        if (addrMatch) {
          return { source: src, base: addrMatch[1].toLowerCase(), quote: addrMatch[2].toLowerCase(), field };
        }
        return null;
      }

      // Для CEX — ищем известный символ
      const split = SYMBOL_SPLIT[symbolPart];
      if (split) {
        return { source: src, base: split.base, quote: split.quote, field };
      }
      return null;
    }
  }

  return null;
}

/**
 * Преобразует адрес токена в человекочитаемое имя.
 * Если адрес неизвестен — возвращает укороченный адрес.
 */
export function tokenDisplayName(token: string): string {
  return TOKEN_NAMES[token.toLowerCase()] ?? `${token.slice(0, 6)}…${token.slice(-4)}`;
}

/**
 * Генерирует pairId из base и quote.
 * Для адресов использует человекочитаемые имена.
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
 * Определяет формат ключей на сервере по массиву ключей.
 */
export function detectKeyFormat(keys: string[]): 'pipe' | 'concat' {
  return keys.some((k) => k.includes('|')) ? 'pipe' : 'concat';
}

/**
 * Генерирует ключи arbiDexMarketData (bid + ask) для данного sourceId + pairId.
 * Пробует оба формата и возвращает оба варианта для совместимости.
 */
export function buildStoreKeys(
  sourceId: string,
  pairId: string,
  format: 'pipe' | 'concat' = 'concat',
): { bidKey: string; askKey: string } | null {
  // pairId = 'ETH_USDT' или 'WETH_USDC'
  const parts = pairId.split('_');
  if (parts.length !== 2) return null;

  const [baseDisplay, quoteDisplay] = parts;

  // Обратный маппинг: символ → адрес (для DEX)
  const reverseTokens: Record<string, string> = {};
  for (const [addr, name] of Object.entries(TOKEN_NAMES)) {
    reverseTokens[name] = addr;
  }

  const base = reverseTokens[baseDisplay] ?? baseDisplay;
  const quote = reverseTokens[quoteDisplay] ?? quoteDisplay;

  if (format === 'pipe') {
    return {
      bidKey: `${sourceId}|${base}|${quote}|bidPrice`,
      askKey: `${sourceId}|${base}|${quote}|askPrice`,
    };
  }

  // Concat format
  if (sourceId.startsWith('dex:')) {
    // DEX: source + addr0 + addr1 + field
    return {
      bidKey: `${sourceId}${base}${quote}bidPrice`,
      askKey: `${sourceId}${base}${quote}askPrice`,
    };
  }

  // CEX: source + BASEQUOTE + field
  const symbol = `${base}${quote}`;
  return {
    bidKey: `${sourceId}${symbol}bidPrice`,
    askKey: `${sourceId}${symbol}askPrice`,
  };
}

