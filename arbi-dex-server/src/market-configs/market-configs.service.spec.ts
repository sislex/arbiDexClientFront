import { MarketConfigsService } from './market-configs.service';

describe('MarketConfigsService real quote chart', () => {
  const config = {
    id: 'config-id',
    userId: 'user-id',
    name: 'BTC/USDC',
    tradingMarketId: 'dex_arbitrum__WBTC_USDC',
    observedMarketIds: ['cex_binance__WBTC_USDC'],
    useWeightedAverage: true,
    weights: { cex_binance__WBTC_USDC: 2 },
  };

  it('builds a union timeline and exposes every configured market', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(config),
    };
    const prices = {
      getPricesByMarket: jest.fn(async (sourceId: string) => {
        if (sourceId === 'dex_arbitrum') {
          return {
            series: [],
            data: [
              { time: 1_000, bidPrice: 99, askPrice: 101, midPrice: 100 },
              { time: 3_000, bidPrice: 101, askPrice: 103, midPrice: 102 },
            ],
          };
        }
        return {
          series: [],
          data: [
            { time: 1_000, bidPrice: 100, askPrice: 102, midPrice: 101 },
            { time: 2_000, bidPrice: 102, askPrice: 104, midPrice: 103 },
            { time: 3_000, bidPrice: 104, askPrice: 106, midPrice: 105 },
          ],
        };
      }),
    };
    const botsRepo = { find: jest.fn(), update: jest.fn() };
    const sessionsRepo = { update: jest.fn() };
    const service = new MarketConfigsService(
      repo as never,
      prices as never,
      botsRepo as never,
      sessionsRepo as never,
    );

    const result = await service.getQuotesRange('user-id', 'config-id');

    expect(result.quotes.map((quote) => quote.time)).toEqual([1_000, 2_000, 3_000]);
    expect(result.quotes[1]).toEqual({
      time: 2_000,
      buyQuote: 101,
      sellQuote: 99,
      avgObservedQuote: 103,
    });
    expect(result.networks).toEqual([
      expect.objectContaining({
        marketId: 'dex_arbitrum__WBTC_USDC',
        label: 'Arbitrum DEX WBTC/USDC',
        role: 'trading',
      }),
      expect.objectContaining({
        marketId: 'cex_binance__WBTC_USDC',
        label: 'Binance WBTC/USDC',
        role: 'observed',
      }),
    ]);

    const trading = result.networks.find((network) => network.role === 'trading')!;
    const observed = result.networks.find((network) => network.role === 'observed')!;
    expect(result.chartPoints[1][`${trading.id}_buy`]).toBe(101);
    expect(result.chartPoints[1][`${observed.id}_buy`]).toBe(104);
    expect(result.chartPoints[1].avg).toBe(103);
  });

  it('bypasses the price cache for every market on refresh', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(config),
    };
    const prices = {
      getPricesByMarket: jest.fn().mockResolvedValue({ series: [], data: [] }),
    };
    const botsRepo = { find: jest.fn(), update: jest.fn() };
    const sessionsRepo = { update: jest.fn() };
    const service = new MarketConfigsService(
      repo as never,
      prices as never,
      botsRepo as never,
      sessionsRepo as never,
    );

    await service.refreshQuotesCache('user-id', 'config-id');

    expect(prices.getPricesByMarket).toHaveBeenCalledTimes(2);
    expect(prices.getPricesByMarket).toHaveBeenCalledWith(
      'dex_arbitrum',
      'WBTC_USDC',
      true,
    );
    expect(prices.getPricesByMarket).toHaveBeenCalledWith(
      'cex_binance',
      'WBTC_USDC',
      true,
    );
  });

  it('returns the actual bounds of the trading market history', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(config),
    };
    const prices = {
      getPricesByMarket: jest.fn().mockResolvedValue({
        series: [],
        data: [
          { time: 1_700_000_000_000, bidPrice: 99, askPrice: 101 },
          { time: 1_800_000_000_000, bidPrice: 100, askPrice: 102 },
        ],
      }),
    };
    const botsRepo = { find: jest.fn(), update: jest.fn() };
    const sessionsRepo = { update: jest.fn() };
    const service = new MarketConfigsService(
      repo as never,
      prices as never,
      botsRepo as never,
      sessionsRepo as never,
    );

    await expect(service.getHistoryRange('user-id', 'config-id')).resolves.toEqual({
      historyFrom: 1_700_000_000_000,
      historyTo: 1_800_000_000_000,
    });
  });
});
