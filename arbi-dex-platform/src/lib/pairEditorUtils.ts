export function resolvePairEntry(
  sel: ChartPairSelection,
  allowedCexNames?: Iterable<string>,
) {
  const dexEntries = sel.dexEntries ?? []
  const rawExchanges = sel.selectedExchanges.length > 0 ? sel.selectedExchanges : []
  const exchanges = rebuildSelectedExchanges(rawExchanges, dexEntries, allowedCexNames)
  const monitoring = sel.purpose === 'monitoring' || !sel.tradingExchange
  const tradingExchange =
    monitoring || !sel.tradingExchange || !exchanges.includes(sel.tradingExchange)
      ? null
      : sel.tradingExchange

  return {
    purpose: monitoring ? ('monitoring' as const) : ('trading' as const),
    exchanges,
    tradingExchange,
    dexAddresses: sel.dexAddresses ?? {},
    dexEntries,
  }
}

export function selectionToTradingPair(
  sel: ChartPairSelection,
  existing?: TradingPair,
  allowedCexNames?: Iterable<string>,
): TradingPair {
  const { purpose, exchanges, tradingExchange, dexAddresses, dexEntries } = resolvePairEntry(
    sel,
    allowedCexNames,
  )

  return {
    id: existing?.id ?? sel.id,
    name: sel.name.trim() || sel.pair.replace('/', ' / '),
    pair: sel.pair,
    purpose,
    exchanges,
    tradingExchange,
    dexAddresses,
    dexEntries,
    coins: sel.pair.split('/'),
    priceMethod: existing?.priceMethod ?? 'Average',
    runningBots: existing?.runningBots ?? 0,
    strategies: existing?.strategies ?? 0,
    created: existing?.created ?? new Date().toISOString().slice(0, 10),
    status: existing?.status ?? 'active',
    spotFutures: existing?.spotFutures ?? 'spot',
  }
}
