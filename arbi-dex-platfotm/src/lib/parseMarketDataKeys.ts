const PRICE_FIELDS = new Set(['bidPrice', 'askPrice'])

/** Разбор ключа формата `source|PAIR|field` (pipe-формат arbiDexMarketData). */
export function parsePipeMarketKey(key: string): { source: string; pair: string; field: string } | null {
  if (!key.includes('|')) return null
  const parts = key.split('|')
  if (parts.length < 3) return null

  const field = parts[parts.length - 1]
  if (!PRICE_FIELDS.has(field)) return null

  const pair = parts[parts.length - 2]
  if (!pair.includes('/')) return null

  const source = parts.slice(0, -2).join('|')
  if (!source) return null

  return { source, pair, field }
}

/** Уникальные символы пар (BTC/USDT, ETH/USDC, …) из списка store keys. */
export function extractPairSymbolsFromKeys(keys: string[]): string[] {
  const symbols = new Set<string>()
  for (const key of keys) {
    const parsed = parsePipeMarketKey(key)
    if (parsed) symbols.add(parsed.pair)
  }
  return [...symbols].sort((a, b) => a.localeCompare(b))
}
