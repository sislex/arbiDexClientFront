import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBotBacktest } from './useServerBotBacktest'
import type { BotPeriodState } from './useBotPeriod'
import type { ServerBot, ServerBotQuotesResponse, ServerQuotePoint } from '../services/botsApi'

const botsApiMocks = vi.hoisted(() => ({
  executeBotTrade: vi.fn(),
  fetchBotQuotes: vi.fn(),
  fetchServerBot: vi.fn(),
  fetchServerStepResult: vi.fn(),
  runServerBacktest: vi.fn(),
}))

vi.mock('../services/botsApi', async () => {
  const actual = await vi.importActual('../services/botsApi')
  return {
    ...actual,
    executeBotTrade: botsApiMocks.executeBotTrade,
    fetchBotQuotes: botsApiMocks.fetchBotQuotes,
    fetchServerBot: botsApiMocks.fetchServerBot,
    fetchServerStepResult: botsApiMocks.fetchServerStepResult,
    runServerBacktest: botsApiMocks.runServerBacktest,
  }
})

function makeQuote(time: number, avg = 100 + time / 1000): ServerQuotePoint {
  return {
    time,
    avgObservedQuote: avg,
    buyQuote: avg + 1,
    sellQuote: avg - 1,
  }
}

function makeQuotesResponse(quotes: ServerQuotePoint[]): ServerBotQuotesResponse {
  return {
    quotes,
    chartPoints: quotes.map((q) => ({
      t: q.time,
      label: new Date(q.time).toISOString(),
      avg: q.avgObservedQuote,
      trading_buy: q.buyQuote,
      trading_sell: q.sellQuote,
    })),
    networks: [{ id: 'trading', label: 'BTC/USDT', marketId: 'm1', role: 'trading' }],
    from: quotes[0]?.time ?? 0,
    to: quotes[quotes.length - 1]?.time ?? 0,
    historyFrom: quotes[0]?.time ?? 0,
    historyTo: quotes[quotes.length - 1]?.time ?? 0,
  }
}

function makeBot(overrides: Partial<ServerBot> = {}): ServerBot {
  return {
    id: 'bot-1',
    name: 'Bot',
    status: 'running',
    mode: 'demo-live',
    marketConfigId: 'market-1',
    strategyConfigId: 'strategy-1',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    initialBalance: 1000,
    balance: 1000,
    pnl: 0,
    pnlPct: 0,
    tradesCount: 0,
    winRate: 0,
    openPosition: false,
    positionSize: 0,
    entryPrice: 0,
    positionOpenedAt: 0,
    slippagePct: 0.5,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}

function makePeriod(from = 1_000, to = 2_000): BotPeriodState {
  return {
    range: { historyFrom: from, historyTo: to },
    from,
    to,
    setFrom: vi.fn(),
    setTo: vi.fn(),
    setPreset: vi.fn(),
    applyRange: vi.fn(),
    dateStr: vi.fn(),
    parseDate: vi.fn(),
    HOUR: 3600_000,
    DAY: 86_400_000,
    WEEK: 7 * 86_400_000,
    MONTH: 30 * 86_400_000,
  }
}

describe('useBotBacktest', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    botsApiMocks.fetchServerBot.mockResolvedValue(makeBot())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not auto-analyze a step on initial history load', async () => {
    const quotes = [makeQuote(1_000), makeQuote(2_000)]
    botsApiMocks.fetchBotQuotes.mockResolvedValue(makeQuotesResponse(quotes))

    const { result } = renderHook(() =>
      useBotBacktest({
        bot: makeBot(),
        period: makePeriod(),
        enabled: true,
      }),
    )

    await waitFor(() => expect(result.current.chartData).toHaveLength(2))
    expect(botsApiMocks.fetchServerStepResult).not.toHaveBeenCalled()
    expect(result.current.stepResult).toBeNull()
    expect(result.current.inspectTime).toBeNull()
  })
})

