import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogService } from './catalog.service';
import { Source } from './entities/source.entity';
import { TradingPair } from './entities/trading-pair.entity';

const mockSources: Source[] = [
  { id: 'cex_binance', name: 'cex_binance', displayName: 'Binance', type: 'cex', icon: null, isActive: true },
  { id: 'dex_arbitrum', name: 'dex_arbitrum', displayName: 'Arbitrum DEX', type: 'dex', icon: null, isActive: true },
  { id: 'cex_inactive', name: 'cex_inactive', displayName: 'Inactive', type: 'cex', icon: null, isActive: false },
];

const mockPairs: TradingPair[] = [
  { id: 'ETH_USDT', base: 'ETH', quote: 'USDT', displayName: 'ETH/USDT' },
  { id: 'WBTC_USDC', base: 'WBTC', quote: 'USDC', displayName: 'WBTC/USDC' },
];

const mockSourcesRepo = { find: jest.fn() };
const mockPairsRepo = { find: jest.fn() };

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: getRepositoryToken(Source), useValue: mockSourcesRepo },
        { provide: getRepositoryToken(TradingPair), useValue: mockPairsRepo },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    jest.clearAllMocks();
  });

  describe('getSources', () => {
    it('должен вернуть только активные источники', async () => {
      mockSourcesRepo.find.mockResolvedValue(
        mockSources.filter((s) => s.isActive),
      );

      const result = await service.getSources();

      expect(result).toHaveLength(2);
      expect(result.every((s) => s.isActive)).toBe(true);
      expect(mockSourcesRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('должен вернуть пустой массив если нет активных источников', async () => {
      mockSourcesRepo.find.mockResolvedValue([]);

      const result = await service.getSources();

      expect(result).toEqual([]);
    });
  });

  describe('getPairs', () => {
    it('должен вернуть все торговые пары', async () => {
      mockPairsRepo.find.mockResolvedValue(mockPairs);

      const result = await service.getPairs();

      expect(result).toEqual(mockPairs);
      expect(result).toHaveLength(2);
    });

    it('должен вернуть пары с корректными полями', async () => {
      mockPairsRepo.find.mockResolvedValue(mockPairs);

      const result = await service.getPairs();

      expect(result[0]).toMatchObject({ id: 'ETH_USDT', base: 'ETH', quote: 'USDT' });
    });
  });
});

