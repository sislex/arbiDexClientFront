import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ArbiConfigsService } from './arbi-configs.service';
import { ArbiConfig } from './entities/arbi-config.entity';
import { ArbiConfigSource } from './entities/arbi-config-source.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

const USER_ID = 'user-uuid-1';

const mockSubscription = (id: string) => ({
  id,
  userId: USER_ID,
  sourceId: 'binance',
  pairId: 'ETH_USDT',
  enabled: true,
  createdAt: new Date(),
});

const mockConfig: any = {
  id: 'config-uuid-1',
  userId: USER_ID,
  name: 'Test Config',
  tradingSubscriptionId: 'sub-trading',
  profitAsset: 'USDC',
  slippage: 0.01,
  initialBalance: 100,
  createdAt: new Date(),
  sources: [
    { id: 'src-1', configId: 'config-uuid-1', subscriptionId: 'sub-ref-1', subscription: mockSubscription('sub-ref-1') },
  ],
  tradingSubscription: mockSubscription('sub-trading'),
};

describe('ArbiConfigsService', () => {
  let service: ArbiConfigsService;

  const mockConfigRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockSourceRepo = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockSubsRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArbiConfigsService,
        { provide: getRepositoryToken(ArbiConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(ArbiConfigSource), useValue: mockSourceRepo },
        { provide: getRepositoryToken(Subscription), useValue: mockSubsRepo },
      ],
    }).compile();

    service = module.get<ArbiConfigsService>(ArbiConfigsService);
    jest.clearAllMocks();
  });

  // ── findAll ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('должен вернуть список конфигов пользователя', async () => {
      mockConfigRepo.find.mockResolvedValue([mockConfig]);

      const result = await service.findAll(USER_ID);

      expect(result).toEqual([mockConfig]);
      expect(mockConfigRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID } }),
      );
    });
  });

  // ── findOne ─────────────────────────────────────────────────

  describe('findOne', () => {
    it('должен вернуть конфиг по ID', async () => {
      mockConfigRepo.findOne.mockResolvedValue(mockConfig);

      const result = await service.findOne(USER_ID, 'config-uuid-1');

      expect(result).toEqual(mockConfig);
    });

    it('должен выбросить NotFoundException если конфиг не найден', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(USER_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name: 'New Config',
      tradingSubscriptionId: 'sub-trading',
      referenceSubscriptionIds: ['sub-ref-1'],
      profitAsset: 'USDC',
      slippage: 0.01,
    };

    it('должен создать конфиг', async () => {
      mockSubsRepo.find.mockResolvedValue([
        mockSubscription('sub-trading'),
        mockSubscription('sub-ref-1'),
      ]);
      mockConfigRepo.create.mockReturnValue({ ...dto, userId: USER_ID });
      mockConfigRepo.save.mockResolvedValue({ ...dto, userId: USER_ID, id: 'new-id' });
      mockSourceRepo.create.mockReturnValue({ configId: 'new-id', subscriptionId: 'sub-ref-1' });
      mockSourceRepo.save.mockResolvedValue([{ configId: 'new-id', subscriptionId: 'sub-ref-1' }]);
      mockConfigRepo.findOne.mockResolvedValue(mockConfig);

      const result = await service.create(USER_ID, dto);

      expect(result).toEqual(mockConfig);
      expect(mockConfigRepo.create).toHaveBeenCalled();
      expect(mockSourceRepo.save).toHaveBeenCalled();
    });

    it('должен выбросить BadRequestException если подписки не принадлежат пользователю', async () => {
      mockSubsRepo.find.mockResolvedValue([mockSubscription('sub-trading')]);

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('должен выбросить BadRequestException если trading в reference', async () => {
      const badDto = {
        ...dto,
        referenceSubscriptionIds: ['sub-trading'],
      };
      mockSubsRepo.find.mockResolvedValue([mockSubscription('sub-trading')]);

      await expect(service.create(USER_ID, badDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── remove ──────────────────────────────────────────────────

  describe('remove', () => {
    it('должен удалить конфиг', async () => {
      mockConfigRepo.findOne.mockResolvedValue(mockConfig);
      mockConfigRepo.remove.mockResolvedValue(mockConfig);

      await service.remove(USER_ID, 'config-uuid-1');

      expect(mockConfigRepo.remove).toHaveBeenCalledWith(mockConfig);
    });

    it('должен выбросить NotFoundException если конфиг не найден', async () => {
      mockConfigRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getSubscriptionIds ──────────────────────────────────────

  describe('getSubscriptionIds', () => {
    it('должен вернуть все subscriptionIds конфига', async () => {
      mockConfigRepo.findOne.mockResolvedValue(mockConfig);

      const result = await service.getSubscriptionIds(USER_ID, 'config-uuid-1');

      expect(result.tradingSubscriptionId).toBe('sub-trading');
      expect(result.referenceSubscriptionIds).toEqual(['sub-ref-1']);
      expect(result.allSubscriptionIds).toContain('sub-trading');
      expect(result.allSubscriptionIds).toContain('sub-ref-1');
    });
  });
});

