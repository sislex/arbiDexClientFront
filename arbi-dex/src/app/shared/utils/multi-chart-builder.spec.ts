import { buildMultiChart, forwardFill, extractFieldKey } from './multi-chart-builder';

describe('multi-chart-builder', () => {
  describe('buildMultiChart', () => {
    it('should merge two subscriptions into a single timeline', () => {
      const subs = [
        { id: 'aaaa1111-0000-0000-0000-000000000000', label: 'Binance — ETH/USDT', role: 'reference' as const },
        { id: 'bbbb2222-0000-0000-0000-000000000000', label: 'DEX — WETH/USDC', role: 'trading' as const },
      ];

      const pricesMap = {
        'aaaa1111-0000-0000-0000-000000000000': {
          series: [
            { key: 'bidPrice', name: 'Binance Bid', color: '#0ecb81' },
            { key: 'askPrice', name: 'Binance Ask', color: '#f6465d' },
          ],
          data: [
            { time: 1000, bidPrice: 100, askPrice: 101 },
            { time: 2000, bidPrice: 102, askPrice: 103 },
          ],
        },
        'bbbb2222-0000-0000-0000-000000000000': {
          series: [
            { key: 'bidPrice', name: 'DEX Bid', color: '#2196f3' },
            { key: 'askPrice', name: 'DEX Ask', color: '#ff9800' },
          ],
          data: [
            { time: 1000, bidPrice: 99, askPrice: 100 },
            { time: 3000, bidPrice: 104, askPrice: 105 },
          ],
        },
      };

      const result = buildMultiChart(subs, pricesMap);

      expect(result.series.length).toBe(4);
      expect(result.data.length).toBe(3); // timestamps: 1000, 2000, 3000
      expect(result.keyPrefixMap.size).toBe(2);

      // First point should have values from both subs
      const first = result.data[0];
      expect(first.time).toBe(1000);

      // Series names should contain role tags
      const tradingSeries = result.series.filter((s) => s.name.includes('[T]'));
      expect(tradingSeries.length).toBe(2);
    });

    it('should return empty for no subscriptions', () => {
      const result = buildMultiChart([], {});
      expect(result.series).toEqual([]);
      expect(result.data).toEqual([]);
    });
  });

  describe('forwardFill', () => {
    it('should fill missing values with previous known values', () => {
      const series = [
        { key: 'a', name: 'A', color: '#000' },
        { key: 'b', name: 'B', color: '#111' },
      ];
      const points = [
        { time: 1, a: 10 } as any,
        { time: 2, b: 20 } as any,
        { time: 3, a: 30 } as any,
      ];

      const filled = forwardFill(points, series);

      // At time=2, 'a' should be forward-filled with 10
      expect(filled[1]['a']).toBe(10);
      expect(filled[1]['b']).toBe(20);
      // At time=3, 'b' should be forward-filled with 20
      expect(filled[2]['a']).toBe(30);
      expect(filled[2]['b']).toBe(20);
    });
  });

  describe('extractFieldKey', () => {
    it('should extract from pipe format', () => {
      expect(extractFieldKey('dex:arbitrum|WETH/USDC|bidPrice')).toBe('bidPrice');
      expect(extractFieldKey('binance|ETH/USDT|askPrice')).toBe('askPrice');
    });

    it('should extract from concat format', () => {
      expect(extractFieldKey('binanceETH/USDTbidPrice')).toBe('bidPrice');
      expect(extractFieldKey('mexcETH/USDTaskPrice')).toBe('askPrice');
    });

    it('should return original key if no match', () => {
      expect(extractFieldKey('unknown')).toBe('unknown');
    });
  });
});


