import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './entities/subscription.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const USER_ID = 'user-uuid-1';

const mockSubscription: Subscription = {
  id: 'sub-uuid-1',
  userId: USER_ID,
  sourceId: 'cex_binance',
  pairId: 'ETH_USDT',
  enabled: true,
  createdAt: new Date(),
  user: null as any,
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: getRepositoryToken(Subscription), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    jest.clearAllMocks();
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('должен вернуть массив подписок пользователя', async () => {
      mockRepo.find.mockResolvedValue([mockSubscription]);

      const result = await service.findAll(USER_ID);

      expect(result).toEqual([mockSubscription]);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { createdAt: 'DESC' },
      });
    });

    it('должен вернуть пустой массив если подписок нет', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findAll(USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('должен создать и вернуть подписку', async () => {
      mockRepo.create.mockReturnValue(mockSubscription);
      mockRepo.save.mockResolvedValue(mockSubscription);

      const result = await service.create(USER_ID, {
        sourceId: 'cex_binance',
        pairId: 'ETH_USDT',
      });

      expect(result).toEqual(mockSubscription);
      expect(mockRepo.create).toHaveBeenCalledWith({
        userId: USER_ID,
        sourceId: 'cex_binance',
        pairId: 'ETH_USDT',
        enabled: true,
      });
    });
  });

  // ── toggle ──────────────────────────────────────────────────────────────────

  describe('toggle', () => {
    it('должен переключить enabled с true на false', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockSubscription, enabled: true });
      mockRepo.save.mockResolvedValue({ ...mockSubscription, enabled: false });

      const result = await service.toggle(USER_ID, 'sub-uuid-1');

      expect(result.enabled).toBe(false);
    });

    it('должен переключить enabled с false на true', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockSubscription, enabled: false });
      mockRepo.save.mockResolvedValue({ ...mockSubscription, enabled: true });

      const result = await service.toggle(USER_ID, 'sub-uuid-1');

      expect(result.enabled).toBe(true);
    });

    it('должен бросить NotFoundException если подписка не найдена', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.toggle(USER_ID, 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('не должен позволить переключить чужую подписку', async () => {
      mockRepo.findOne.mockResolvedValue(null); // findOne({ where: { id, userId } }) вернёт null

      await expect(service.toggle('other-user', 'sub-uuid-1')).rejects.toThrow(NotFoundException);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'sub-uuid-1', userId: 'other-user' },
      });
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('должен удалить подписку', async () => {
      mockRepo.findOne.mockResolvedValue(mockSubscription);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.remove(USER_ID, 'sub-uuid-1');

      expect(mockRepo.remove).toHaveBeenCalledWith(mockSubscription);
    });

    it('должен бросить NotFoundException если подписка не найдена', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});

