import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StrategySimulationWorkspace } from './StrategySimulationWorkspace'

vi.mock('ag-charts-react', () => ({
  AgCharts: () => <div data-testid="ag-charts" />,
}))

vi.mock('./useSimulatorI18n', () => ({
  useSimulatorI18n: () => ({
    t: (key: string) => key,
  }),
}))

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    chartData: [
      { t: 1_000, label: 'a', avg: 100, trading_buy: 101, trading_sell: 99 },
      { t: 2_000, label: 'b', avg: 101, trading_buy: 102, trading_sell: 100 },
    ],
    chartFullData: [
      { t: 1_000, label: 'a', avg: 100, trading_buy: 101, trading_sell: 99 },
      { t: 2_000, label: 'b', avg: 101, trading_buy: 102, trading_sell: 100 },
    ],
    events: [],
    stepResult: null,
    networks: [{ id: 'trading', label: 'BTC/USDT', color: '#7C3AED' }],
    tradingNetworkIds: new Set(['trading']),
    playIdx: 2,
    onPlayIdxChange: vi.fn(),
    isPlaying: false,
    onPlayingChange: vi.fn(),
    speed: 1,
    onSpeedChange: vi.fn(),
    loading: false,
    error: null,
    token1Label: 'BTC',
    token2Label: 'USDT',
    header: {
      pairLabel: 'BTC/USDT',
      networksLabel: 'BTC/USDT',
      profitCurrency: 'USDT',
    },
    onChartStepInspect: vi.fn(),
    ...overrides,
  }
}

describe('StrategySimulationWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inspects on short click but not on drag', async () => {
    const onChartStepInspect = vi.fn()
    render(<StrategySimulationWorkspace {...makeProps({ onChartStepInspect })} />)

    const panel = screen.getByTestId('simulation-chart-panel')
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 600,
      height: 300,
      right: 600,
      bottom: 300,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.mouseDown(panel, { clientX: 200, clientY: 100 })
    fireEvent.mouseUp(window, { clientX: 200, clientY: 100 })

    await waitFor(() => expect(onChartStepInspect).toHaveBeenCalledTimes(1))

    fireEvent.mouseDown(panel, { clientX: 200, clientY: 100 })
    fireEvent.mouseMove(panel, { clientX: 240, clientY: 100 })
    fireEvent.mouseUp(window, { clientX: 240, clientY: 100 })

    expect(onChartStepInspect).toHaveBeenCalledTimes(1)
  })
})

