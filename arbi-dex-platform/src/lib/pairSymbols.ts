/** EVM-style contract or wallet address fragment. */
const EVM_ADDRESS = /^0x[a-fA-F0-9]{10,}$/

/** Standard CEX ticker symbol (e.g. BTC, USDT, WBTC). */
const CEX_TICKER = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * Returns true when the pair symbol is a standard CEX name (e.g. "BTC/USDT").
 * Excludes pairs whose base or quote contains contract/wallet addresses.
 */
export function isStandardCexPairSymbol(symbol: string): boolean {
  const trimmed = symbol.trim()
  if (!trimmed.includes('/')) return false

  const slashIndex = trimmed.indexOf('/')
  const base = trimmed.slice(0, slashIndex)
  const quote = trimmed.slice(slashIndex + 1)

  if (!base || !quote) return false
  if (base.includes('/') || quote.includes('/')) return false

  if (EVM_ADDRESS.test(base) || EVM_ADDRESS.test(quote)) return false
  if (base.includes('0x') || quote.includes('0x')) return false

  return CEX_TICKER.test(base) && CEX_TICKER.test(quote)
}

export function filterStandardCexPairSymbols(symbols: readonly string[]): string[] {
  return [...new Set(symbols.filter(isStandardCexPairSymbol))].sort((a, b) => a.localeCompare(b))
}

export function getDefaultCexPairSymbol(symbols: readonly string[], fallback = 'BTC/USDT'): string {
  const standard = filterStandardCexPairSymbols(symbols)
  return standard[0] ?? fallback
}
