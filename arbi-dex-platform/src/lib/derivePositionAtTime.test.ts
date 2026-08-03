import { describe, expect, it } from 'vitest'
import { derivePositionAtTime } from './derivePositionAtTime'

describe('derivePositionAtTime', () => {
  it('keeps position open at the exact sell trigger time', () => {
    const pos = derivePositionAtTime(
      [
        { time: 1_000, side: 'buy', price: 100, amount: 1 },
        { time: 2_000, side: 'sell', price: 95, amount: 1 },
      ],
      2_000,
    )
    expect(pos).toEqual({ entryPrice: 100, openedAt: 1_000, size: 1 })
  })

  it('returns null after the sell when inspecting a later time', () => {
    const pos = derivePositionAtTime(
      [
        { time: 1_000, side: 'buy', price: 100, amount: 1 },
        { time: 2_000, side: 'sell', price: 95, amount: 1 },
      ],
      2_001,
    )
    expect(pos).toBeNull()
  })

  it('returns open buy between buy and sell', () => {
    const pos = derivePositionAtTime(
      [
        { time: 1_000, side: 'buy', price: 100, amount: 1 },
        { time: 3_000, side: 'sell', price: 95, amount: 1 },
      ],
      2_000,
    )
    expect(pos).toEqual({ entryPrice: 100, openedAt: 1_000, size: 1 })
  })
})
