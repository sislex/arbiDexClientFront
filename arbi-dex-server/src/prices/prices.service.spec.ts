import { of } from 'rxjs';
import { PricesService } from './prices.service';

describe('PricesService DEX orientation', () => {
  it('requests DEX token addresses in reverse order', async () => {
    const bidKey =
      'dex:arbitrum|0xaf88d065e77c8cc2239327c5edb3a432268e5831/0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f|bidPrice';
    const askKey =
      'dex:arbitrum|0xaf88d065e77c8cc2239327c5edb3a432268e5831/0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f|askPrice';
    const http = {
      get: jest.fn().mockReturnValue(of({ data: [bidKey, askKey] })),
      post: jest.fn().mockReturnValue(of({
        data: {
          [bidKey]: { points: [{ t: 1_000, v: 64_900 }] },
          [askKey]: { points: [{ t: 1_000, v: 65_000 }] },
        },
      })),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://market-data'),
    };
    const service = new PricesService(http as never, config as never, {} as never);

    const result = await service.getPricesByMarket(
      'dex:arbitrum',
      'WBTC_USDC',
      true,
    );

    expect(http.post).toHaveBeenCalledWith('http://market-data/store/keys', {
      keys: [bidKey, askKey],
    });
    expect(result.data).toEqual([
      { time: 1_000, bidPrice: 64_900, askPrice: 65_000 },
    ]);
  });

  it('keeps the original direction for CEX pairs', async () => {
    const bidKey = 'binance|BTC/USDC|bidPrice';
    const askKey = 'binance|BTC/USDC|askPrice';
    const http = {
      get: jest.fn().mockReturnValue(of({ data: [bidKey, askKey] })),
      post: jest.fn().mockReturnValue(of({
        data: {
          [bidKey]: { points: [{ t: 1_000, v: 64_900 }] },
          [askKey]: { points: [{ t: 1_000, v: 65_000 }] },
        },
      })),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('http://market-data'),
    };
    const service = new PricesService(http as never, config as never, {} as never);

    await service.getPricesByMarket('binance', 'BTC_USDC', true);

    expect(http.post).toHaveBeenCalledWith('http://market-data/store/keys', {
      keys: [bidKey, askKey],
    });
  });
});
