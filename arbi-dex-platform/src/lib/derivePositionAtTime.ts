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

/**
 * Position held when evaluating the step at `time` (decision-time view).
 * A sell at exactly `time` does NOT close the position yet — otherwise
 * stop-loss / take-profit / max-hold inspect at the trigger tick would see
 * `position === null` and show «нет».
 */
export function derivePositionAtTime(
  trades: PositionTrade[],
  time: number,
): DerivedPosition | null {
  if (trades.length === 0) return null
  const sorted = [...trades].sort((a, b) => a.time - b.time)
  let openBuy: PositionTrade | null = null
  for (const t of sorted) {
    if (t.time > time) break
    if (t.side === 'buy') {
      openBuy = t
      continue
    }
    // Sell strictly before `time` closes; sell at `time` is the decision itself.
    if (t.side === 'sell' && t.time < time) openBuy = null
  }
  if (!openBuy || openBuy.price <= 0) return null
  return {
    entryPrice: openBuy.price,
    openedAt: openBuy.time,
    size: openBuy.amount,
  }
}
