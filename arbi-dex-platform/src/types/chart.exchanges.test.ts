import { describe, expect, it } from 'vitest'
import { rebuildSelectedExchanges, type DexEntry } from '../types/chart'

describe('rebuildSelectedExchanges', () => {
  it('drops CEX not in allowed store list (ghost OKX/Kraken)', () => {
    const dexEntries: DexEntry[] = [
      { id: 'd1', network: 'Arbitrum' },
      { id: 'd2', network: 'Linea' },
      { id: 'd3', network: 'Blast' },
    ]
    const raw = ['Binance', 'Bybit', 'OKX', 'Kraken', 'Arbitrum', 'Linea', 'Blast']
    const pruned = rebuildSelectedExchanges(raw, dexEntries, ['Binance', 'Bybit'])
    expect(pruned).toEqual(['Binance', 'Bybit', 'Arbitrum', 'Linea', 'Blast'])
    expect(pruned).toHaveLength(5)
  })
})
