import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ServerBotSimulationPage } from './ServerBotSimulationPage'
import type { ServerBot } from '../services/botsApi'

const hookMocks = vi.hoisted(() => ({
  useBotBacktest: vi.fn(),
}))

vi.mock('../hooks/useServerBotBacktest', () => ({
  useBotBacktest: hookMocks.useBotBacktest,
}))

vi.mock('../hooks/useBotPeriod', () => ({
  useBotPeriod: () => ({
    range: { historyFrom: 1_000, historyTo: 2_000 },
    from: 1_000,
    to: 2_000,
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
  }),
  applyChartPeriodPick: vi.fn(),
}))

vi.mock('../components/bot/BotBacktestPeriodPicker', () => ({
  BotBacktestPeriodPicker: () => <div data-testid="period-picker" />,
  applyChartPeriodPick: vi.fn(),
}))

vi.mock('../components/bot/BotExcludedRangesPicker', () => ({
  BotExcludedRangesPicker: ({ ranges }: { ranges: Array<{ id: string; start: number; end: number }> }) => (
    <div data-testid="excluded-ranges-picker">{JSON.stringify(ranges)}</div>
  ),
}))

vi.mock('./StrategySimulationWorkspace', () => ({
  StrategySimulationWorkspace: ({
    chartToolbar,
    eventLogRevision,
    excludedRanges,
  }: {
    chartToolbar: React.ReactNode
    eventLogRevision: number
    excludedRanges: Array<{ start: number; end: number }>
  }) => (
    <div>
      <div data-testid="workspace-event-log-revision">{String(eventLogRevision)}</div>
      <div data-testid="workspace-excluded-ranges">{JSON.stringify(excludedRanges)}</div>
      {chartToolbar}
    </div>
  ),
}))

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

function makeHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    chartData: [{ t: 1_000, label: 'a', avg: 100, trading_buy: 101, trading_sell: 99 }],
    fullChartData: [{ t: 1_000, label: 'a', avg: 100, trading_buy: 101, trading_sell: 99 }],
    events: [],
    backtestRevision: 7,
    stepResult: null,
    displayNetworks: [{ id: 'trading', label: 'BTC/USDT', color: '#fff' }],
    tradingNetworkIds: new Set(['trading']),
    playIdx: 1,
    setPlayIdx: vi.fn(),
    isPlaying: false,
    setIsPlaying: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
    loading: false,
    backtestLoading: false,
    error: null,
    token1Label: 'BTC',
    token2Label: 'USDT',
    backtest: null,
    hasObservedAvg: true,
    inspectTime: null,
    stepAnalyzing: false,
    stepError: null,
    refreshChart: vi.fn(),
    runBacktest: vi.fn(),
    analyzeCurrentStep: vi.fn(),
    inspectStep: vi.fn(),
    inspectViaApi: vi.fn(),
    executeBuy: vi.fn(),
    executeSell: vi.fn(),
    tradePending: false,
    tradeError: null,
    canBuy: true,
    canSell: false,
    lastPrice: '100',
    ...overrides,
  }
}

describe('ServerBotSimulationPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('restores persisted excluded ranges per bot id and passes backtestRevision to the workspace', () => {
    localStorage.setItem(
      'arbidex-excluded-ranges-bot-1',
      JSON.stringify({
        savedAt: Date.now(),
        ranges: [{ id: 'ex-1', start: 1_100, end: 1_200 }],
      }),
    )
    hookMocks.useBotBacktest.mockReturnValue(makeHookReturn())

    render(<ServerBotSimulationPage bot={makeBot()} />)

    expect(screen.getByTestId('excluded-ranges-picker')).toHaveTextContent('"id":"ex-1"')
    expect(screen.getByTestId('workspace-excluded-ranges')).toHaveTextContent('"start":1100')
    expect(screen.getByTestId('workspace-event-log-revision')).toHaveTextContent('7')
  })

  it('loads a different persisted excluded range set after bot switch', () => {
    localStorage.setItem(
      'arbidex-excluded-ranges-bot-1',
      JSON.stringify({
        savedAt: Date.now(),
        ranges: [{ id: 'ex-1', start: 1_100, end: 1_200 }],
      }),
    )
    localStorage.setItem(
      'arbidex-excluded-ranges-bot-2',
      JSON.stringify({
        savedAt: Date.now(),
        ranges: [{ id: 'ex-2', start: 2_100, end: 2_200 }],
      }),
    )
    hookMocks.useBotBacktest.mockReturnValue(makeHookReturn())

    const { rerender } = render(<ServerBotSimulationPage bot={makeBot({ id: 'bot-1' })} />)
    expect(screen.getByTestId('excluded-ranges-picker')).toHaveTextContent('"id":"ex-1"')

    rerender(<ServerBotSimulationPage bot={makeBot({ id: 'bot-2' })} />)
    expect(screen.getByTestId('excluded-ranges-picker')).toHaveTextContent('"id":"ex-2"')
  })

  it('calls refreshChart from the toolbar button', async () => {
    const user = userEvent.setup()
    const refreshChart = vi.fn()
    hookMocks.useBotBacktest.mockReturnValue(makeHookReturn({ refreshChart }))

    render(<ServerBotSimulationPage bot={makeBot()} />)

    await user.click(screen.getByRole('button', { name: 'Обновить график' }))
    expect(refreshChart).toHaveBeenCalledTimes(1)
  })
})

