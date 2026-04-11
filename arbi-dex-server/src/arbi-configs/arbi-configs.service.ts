import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ArbiConfig } from './entities/arbi-config.entity';
import { ArbiConfigSource } from './entities/arbi-config-source.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CreateArbiConfigDto, UpdateArbiConfigDto } from './dto/arbi-config.dto';

@Injectable()
export class ArbiConfigsService {
  constructor(
    @InjectRepository(ArbiConfig)
    private readonly configRepo: Repository<ArbiConfig>,
    @InjectRepository(ArbiConfigSource)
    private readonly sourceRepo: Repository<ArbiConfigSource>,
    @InjectRepository(Subscription)
    private readonly subsRepo: Repository<Subscription>,
  ) {}

  /** Все конфиги текущего пользователя */
  async findAll(userId: string): Promise<ArbiConfig[]> {
    return this.configRepo.find({
      where: { userId },
      relations: ['sources', 'sources.subscription', 'tradingSubscription'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Один конфиг по ID (с проверкой владельца) */
  async findOne(userId: string, id: string): Promise<ArbiConfig> {
    const config = await this.configRepo.findOne({
      where: { id, userId },
      relations: ['sources', 'sources.subscription', 'tradingSubscription'],
    });
    if (!config) {
      throw new NotFoundException('Конфиг не найден');
    }
    return config;
  }

  /** Создать новый конфиг */
  async create(userId: string, dto: CreateArbiConfigDto): Promise<ArbiConfig> {
    // Валидация: все подписки принадлежат пользователю
    const allSubIds = [dto.tradingSubscriptionId, ...dto.referenceSubscriptionIds];
    await this.validateSubscriptionOwnership(userId, allSubIds);

    // tradingSubscriptionId не должен дублироваться в reference
    if (dto.referenceSubscriptionIds.includes(dto.tradingSubscriptionId)) {
      throw new BadRequestException(
        'Торговый источник не должен быть в списке референсных источников',
      );
    }

    const config = this.configRepo.create({
      userId,
      name: dto.name,
      tradingSubscriptionId: dto.tradingSubscriptionId,
      profitAsset: dto.profitAsset,
      slippage: dto.slippage,
      initialBalance: dto.initialBalance ?? 100,
    });

    const saved = await this.configRepo.save(config);

    // Создаём reference sources
    const sources = dto.referenceSubscriptionIds.map((subId) =>
      this.sourceRepo.create({ configId: saved.id, subscriptionId: subId }),
    );
    await this.sourceRepo.save(sources);

    return this.findOne(userId, saved.id);
  }

  /** Обновить конфиг */
  async update(
    userId: string,
    id: string,
    dto: UpdateArbiConfigDto,
  ): Promise<ArbiConfig> {
    const config = await this.findOne(userId, id);

    // Валидация подписок если переданы
    const subIdsToCheck: string[] = [];
    if (dto.tradingSubscriptionId) subIdsToCheck.push(dto.tradingSubscriptionId);
    if (dto.referenceSubscriptionIds) subIdsToCheck.push(...dto.referenceSubscriptionIds);
    if (subIdsToCheck.length > 0) {
      await this.validateSubscriptionOwnership(userId, subIdsToCheck);
    }

    const tradingId = dto.tradingSubscriptionId ?? config.tradingSubscriptionId;
    const refIds = dto.referenceSubscriptionIds ??
      config.sources.map((s) => s.subscriptionId);

    if (refIds.includes(tradingId)) {
      throw new BadRequestException(
        'Торговый источник не должен быть в списке референсных источников',
      );
    }

    // Обновляем основные поля
    if (dto.name !== undefined) config.name = dto.name;
    if (dto.tradingSubscriptionId !== undefined)
      config.tradingSubscriptionId = dto.tradingSubscriptionId;
    if (dto.profitAsset !== undefined) config.profitAsset = dto.profitAsset;
    if (dto.slippage !== undefined) config.slippage = dto.slippage;
    if (dto.initialBalance !== undefined) config.initialBalance = dto.initialBalance;

    await this.configRepo.save(config);

    // Обновляем reference sources если переданы
    if (dto.referenceSubscriptionIds) {
      await this.sourceRepo.delete({ configId: id });
      const sources = dto.referenceSubscriptionIds.map((subId) =>
        this.sourceRepo.create({ configId: id, subscriptionId: subId }),
      );
      await this.sourceRepo.save(sources);
    }

    return this.findOne(userId, id);
  }

  /** Удалить конфиг */
  async remove(userId: string, id: string): Promise<void> {
    const config = await this.findOne(userId, id);
    await this.configRepo.remove(config);
  }

  /** Получить все subscriptionIds конфига (reference + trading) */
  async getSubscriptionIds(userId: string, id: string): Promise<{
    tradingSubscriptionId: string;
    referenceSubscriptionIds: string[];
    allSubscriptionIds: string[];
  }> {
    const config = await this.findOne(userId, id);
    const referenceSubscriptionIds = config.sources.map((s) => s.subscriptionId);
    return {
      tradingSubscriptionId: config.tradingSubscriptionId,
      referenceSubscriptionIds,
      allSubscriptionIds: [config.tradingSubscriptionId, ...referenceSubscriptionIds],
    };
  }

  /** Проверяет что все подписки принадлежат пользователю */
  private async validateSubscriptionOwnership(
    userId: string,
    subscriptionIds: string[],
  ): Promise<void> {
    const unique = [...new Set(subscriptionIds)];
    const subs = await this.subsRepo.find({
      where: { id: In(unique), userId },
    });
    if (subs.length !== unique.length) {
      const foundIds = new Set(subs.map((s) => s.id));
      const missing = unique.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Подписки не найдены или не принадлежат вам: ${missing.join(', ')}`,
      );
    }
  }
}

