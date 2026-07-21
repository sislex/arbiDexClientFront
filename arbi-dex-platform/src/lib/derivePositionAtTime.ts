/** Minimal trade fields to replay open position at a point in time. */
export interface PositionTrade {
  time: number
  side: 'buy' | 'sell'
  price: number
  amount: number
}

export interface DerivedPosition {
  entryPrice: number
  openedAt: number
  size: number
}

/** Open long position held at `time` (last buy not yet closed by a sell at or before `time`). */
export function derivePositionAtTime(
  trades: PositionTrade[],
  time: number,
): DerivedPosition | null {
  if (trades.length === 0) return null
  const sorted = [...trades].sort((a, b) => a.time - b.time)
  let openBuy: PositionTrade | null = null
  for (const t of sorted) {
    if (t.time > time) break
    if (t.side === 'buy') openBuy = t
    else if (t.side === 'sell') openBuy = null
  }
  if (!openBuy || openBuy.price <= 0) return null
  return {
    entryPrice: openBuy.price,
    openedAt: openBuy.time,
    size: openBuy.amount,
  }
}
