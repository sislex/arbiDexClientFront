import type { Repository } from 'typeorm';
import { vi } from 'vitest';
import { LiveEngineService } from './live-engine.service';
import { Bot } from './entities/bot.entity';

const engineMocks = vi.hoisted(() => ({
  prepareSteps: vi.fn(() => ({ steps: [{}] })),
  processStep: vi.fn(),
  toEngineStrategy: vi.fn(() => ({ strategy: {}, gates: [], triggers: [] })),
}))

vi.mock('@sislex/arbi-conditions-libs', async () => {
  const actual = await vi.importActual('@sislex/arbi-conditions-libs')
  return {
    ...actual,
    prepareSteps: engineMocks.prepareSteps,
    processStep: engineMocks.processStep,
  }
})

vi.mock('../demo/engine/strategy-engine.mapper', async () => {
  const actual = await vi.importActual('../demo/engine/strategy-engine.mapper')
  return {
    ...actual,
    toEngineStrategy: engineMocks.toEngineStrategy,
  }
})

function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: 'bot-1',
    userId: 'user-1',
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
    txInProgressUntil: 0,
    minPositionValue: 0,
    lastSignalAt: 0,
    lastTickAt: 0,
    failCooldownUntil: 0,
    startedAt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Bot
}

function makeService() {
  const botsRepo = {
    find: vi.fn(),
    update: vi.fn(async () => undefined),
  } as unknown as Repository<Bot>
  const liveTrading = {
    trade: vi.fn(),
  }
  const botsService = {
    ensureSession: vi.fn(async () => undefined),
    enrichStepsWithTrades: vi.fn(async () => undefined),
  }
  const marketConfigs = {
    refreshQuotesCache: vi.fn(async () => undefined),
    getQuotesRange: vi.fn(),
  }
  const strategyConfigs = {
    findOne: vi.fn(async () => ({ buy: [], sell: [] })),
  }

  const service = new LiveEngineService(
    botsRepo,
    liveTrading as never,
    botsService as never,
    marketConfigs as never,
    strategyConfigs as never,
  )

  return { service, botsRepo, liveTrading, botsService, marketConfigs, strategyConfigs }
}

describe('LiveEngineService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not execute the same last quote step twice', async () => {
    const { service, liveTrading, botsService, marketConfigs } = makeService()
    const bot = makeBot({ balance: 1000 })
    marketConfigs.getQuotesRange.mockResolvedValue({
      quotes: [
        { time: 1_000, buyQuote: 101, sellQuote: 99, avgObservedQuote: 100 },
        { time: 2_000, buyQuote: 100, sellQuote: 98, avgObservedQuote: 100 },
      ],
    })
    engineMocks.processStep.mockReturnValue({
      transaction: { buy: true, sell: false, forcedSell: false },
      condition: { buy: {}, sell: { transaction_delay_ok: { passed: true } } },
      meta: {},
    })
    liveTrading.trade.mockResolvedValue({ trade: { status: 'success', price: 100, error: null } })

    await (service as any).stepBot(bot)
    await (service as any).stepBot(bot)

    expect(botsService.ensureSession).toHaveBeenCalledTimes(2)
    expect(liveTrading.trade).toHaveBeenCalledTimes(1)
    expect(liveTrading.trade).toHaveBeenCalledWith(
      'user-1',
      'bot-1',
      { side: 'buy', expectedPrice: 100 },
      expect.objectContaining({
        stepResult: expect.objectContaining({
          index: 1,
          totalSteps: 2,
          step: expect.objectContaining({ time: 2_000 }),
        }),
      }),
    )
  })

  it('sets cooldown after a failed trade and skips the next tick before expiry', async () => {
    const { service, liveTrading, marketConfigs, botsRepo } = makeService()
    const bot = makeBot({
      openPosition: true,
      positionSize: 1,
      entryPrice: 105,
      positionOpenedAt: 1_000,
    })
    marketConfigs.getQuotesRange.mockResolvedValue({
      quotes: [
        { time: 1_000, buyQuote: 106, sellQuote: 104, avgObservedQuote: 105 },
        { time: 2_000, buyQuote: 103, sellQuote: 101, avgObservedQuote: 102 },
      ],
    })
    engineMocks.processStep.mockReturnValue({
      transaction: { buy: false, sell: false, forcedSell: true },
      condition: { buy: {}, sell: { transaction_delay_ok: { passed: true } } },
      meta: {},
    })
    liveTrading.trade.mockResolvedValue({ trade: { status: 'failed', price: null, error: 'slippage' } })

    await (service as any).stepBot(bot)
    await (service as any).stepBot(bot)

    expect(liveTrading.trade).toHaveBeenCalledTimes(1)
    expect(botsRepo.update).toHaveBeenCalledWith(
      'bot-1',
      expect.objectContaining({ failCooldownUntil: expect.any(Number) }),
    )
  })
})

