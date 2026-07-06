import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ArbiConfig } from './entities/arbi-config.entity';
import { ArbiConfigSource } from './entities/arbi-config-source.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CreateArbiConfigDto, UpdateArbiConfigDto } from './dto/arbi-config.dto';
import { PricesService, SubscriptionPriceData, ChartPricePoint } from '../prices/prices.service';
import { BacktestEngine, BacktestConfig, BacktestTick, BacktestResult } from './engine/backtest.engine';
import { runEngineBacktest, EngineBacktestResult } from './analytics/engine-backtest';

/**
 * Результат новой реализации бэктеста — на общем движке стратегии с трекингом
 * позиции. Форма: BacktestResult (итоги/PnL/сделки) плюс компактная движковая
 * сводка и ограниченная выборка «значимых» шагов (см. EngineBacktestResult).
 * Полный пошаговый массив НЕ отдаётся (точек могут быть сотни тысяч).
 */
export type BacktestNewResult = EngineBacktestResult;

@Injectable()
export class ArbiConfigsService {
  private readonly logger = new Logger(ArbiConfigsService.name);

  constructor(
    @InjectRepository(ArbiConfig)
    private readonly configRepo: Repository<ArbiConfig>,
    @InjectRepository(ArbiConfigSource)
    private readonly sourceRepo: Repository<ArbiConfigSource>,
    @InjectRepository(Subscription)
    private readonly subsRepo: Repository<Subscription>,
    private readonly pricesService: PricesService,
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
      autoBuyThresholdPct: dto.autoBuyThresholdPct ?? null,
      autoSellThresholdPct: dto.autoSellThresholdPct ?? null,
      trailingTakeProfitPct: dto.trailingTakeProfitPct ?? null,
      stopLossPct: dto.stopLossPct ?? null,
      tradeAmountPct: dto.tradeAmountPct ?? 100,
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
    if (dto.autoBuyThresholdPct !== undefined) config.autoBuyThresholdPct = dto.autoBuyThresholdPct;
    if (dto.autoSellThresholdPct !== undefined) config.autoSellThresholdPct = dto.autoSellThresholdPct;
    if (dto.trailingTakeProfitPct !== undefined) config.trailingTakeProfitPct = dto.trailingTakeProfitPct;
    if (dto.stopLossPct !== undefined) config.stopLossPct = dto.stopLossPct;
    if (dto.tradeAmountPct !== undefined) config.tradeAmountPct = dto.tradeAmountPct;

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

  /* ── Backtest ── */

  /**
   * Запускает бэктест автоторговли на исторических данных конфига.
   * Загружает цены, объединяет timeline, прогоняет через BacktestEngine.
   */
  async runBacktest(userId: string, configId: string): Promise<BacktestResult> {
    const startMs = Date.now();
    const config = await this.findOne(userId, configId);
    const referenceSubIds = config.sources.map((s) => s.subscriptionId);
    const tradingSubId = config.tradingSubscriptionId;
    const allSubIds = [tradingSubId, ...referenceSubIds];

    // 1. Загружаем цены для всех подписок (используя кэш)
    const pricesMap: Record<string, SubscriptionPriceData> = {};
    for (const subId of allSubIds) {
      try {
        pricesMap[subId] = await this.pricesService.getPricesBySubscription(subId, userId);
      } catch {
        pricesMap[subId] = { series: [], data: [] };
      }
    }

    // 2. Объединяем timeline (аналог buildMultiChart на фронтенде)
    const ticks = this.buildBacktestTicks(pricesMap, tradingSubId, referenceSubIds);

    if (ticks.length === 0) {
      throw new BadRequestException('Нет исторических данных для бэктеста');
    }

    // 3. Прогоняем через движок
    const engine = new BacktestEngine({
      autoBuyThresholdPct: config.autoBuyThresholdPct,
      autoSellThresholdPct: config.autoSellThresholdPct,
      trailingTakeProfitPct: config.trailingTakeProfitPct,
      stopLossPct: config.stopLossPct,
      tradeAmountPct: config.tradeAmountPct,
      slippage: config.slippage,
      initialBalance: config.initialBalance,
    });

    const result = engine.run(ticks);
    const elapsed = Date.now() - startMs;
    this.logger.log(
      `Бэктест ${configId}: ${ticks.length} точек, ${result.totalTrades} сделок, PnL: ${result.pnl} USDC (${result.pnlPct}%), время: ${elapsed}мс`,
    );

    return result;
  }

  /**
   * Новая реализация бэктеста.
   *
   * Из конфига берём только initialBalance и массив котировок (строится из
   * подписок конфига). По котировкам формируем шаги, на каждом шаге — 3 координаты:
   *   1) наблюдаемая средняя цена по reference-рынкам (observedPrice),
   *   2) цена покупки на торговом рынке (buyPrice = ask),
   *   3) цена продажи на торговом рынке (sellPrice = bid).
   *
   * Каждый шаг прогоняется через переиспользуемый helper аналитики
   * (`evaluateConditions`) с конфигом условий из conditions.config.json.
   * Helper возвращает, какие условия прошли / не прошли. По результатам условий
   * и текущей позиции выбирается действие (buy/sell/none) и симулируются сделки.
   *
   * Возвращает BacktestResult (итоги/PnL/сделки) + пошаговую аналитику.
   */
  async runBacktestNew(userId: string, configId: string): Promise<BacktestNewResult> {
    const startMs = Date.now();
    const config = await this.findOne(userId, configId);

    const referenceSubIds = config.sources.map((s) => s.subscriptionId);
    const tradingSubId = config.tradingSubscriptionId;
    const allSubIds = [tradingSubId, ...referenceSubIds];

    // Загружаем котировки (используя кэш)
    const pricesMap: Record<string, SubscriptionPriceData> = {};
    for (const subId of allSubIds) {
      try {
        pricesMap[subId] = await this.pricesService.getPricesBySubscription(subId, userId);
      } catch {
        pricesMap[subId] = { series: [], data: [] };
      }
    }

    // Строим массив тиков: time + buyPrice(ask) / sellPrice(bid) / observed(avgRef)
    const ticks = this.buildBacktestTicks(pricesMap, tradingSubId, referenceSubIds);
    if (ticks.length === 0) {
      throw new BadRequestException('Нет исторических данных для бэктеста');
    }

    // Симуляция на общем движке стратегии: реальные параметры конфига
    // (auto-buy/sell пороги + stop-loss + trailing take-profit) с трекингом
    // позиции, slippage и tradeAmountPct.
    const strategyConfig: BacktestConfig = {
      autoBuyThresholdPct: config.autoBuyThresholdPct,
      autoSellThresholdPct: config.autoSellThresholdPct,
      trailingTakeProfitPct: config.trailingTakeProfitPct,
      stopLossPct: config.stopLossPct,
      tradeAmountPct: config.tradeAmountPct,
      slippage: config.slippage,
      initialBalance: config.initialBalance,
    };
    const result = runEngineBacktest(ticks, strategyConfig);

    const elapsed = Date.now() - startMs;
    this.logger.log(
      `Бэктест (engine) ${configId}: ${ticks.length} точек, ${result.totalTrades} сделок, ` +
        `значимых шагов: ${result.significantSteps} (отдано ${result.steps.length}), ` +
        `PnL: ${result.pnl} USDC (${result.pnlPct}%), время: ${elapsed}мс`,
    );

    return result;
  }

  /**
   * Объединяет ценовые данные из разных подписок в единый массив тиков.
   * Логика аналогична фронтенду: merge по timeline, forward-fill, extraction bid/ask/mid.
   */
  private buildBacktestTicks(
    pricesMap: Record<string, SubscriptionPriceData>,
    tradingSubId: string,
    referenceSubIds: string[],
  ): BacktestTick[] {
    // Собираем все уникальные timestamps
    const timeSet = new Set<number>();
    for (const subId of [tradingSubId, ...referenceSubIds]) {
      const data = pricesMap[subId]?.data ?? [];
      for (const pt of data) {
        timeSet.add(pt.time);
      }
    }

    const sortedTimes = Array.from(timeSet).sort((a, b) => a - b);
    if (sortedTimes.length === 0) return [];

    // Для каждой подписки строим Map time → point для быстрого доступа
    const subDataMaps = new Map<string, Map<number, ChartPricePoint>>();
    for (const subId of [tradingSubId, ...referenceSubIds]) {
      const dataMap = new Map<number, ChartPricePoint>();
      for (const pt of pricesMap[subId]?.data ?? []) {
        dataMap.set(pt.time, pt);
      }
      subDataMaps.set(subId, dataMap);
    }

    // Forward-fill: итерируемся по timeline, извлекаем bid/ask/mid с заполнением пропусков
    const lastValues = new Map<string, { bid: number; ask: number; mid: number }>();
    const ticks: BacktestTick[] = [];

    for (let i = 0; i < sortedTimes.length; i++) {
      const time = sortedTimes[i];

      // Извлекаем цены для каждой подписки с forward-fill
      for (const subId of [tradingSubId, ...referenceSubIds]) {
        const dataMap = subDataMaps.get(subId)!;
        const pt = dataMap.get(time);
        const prev = lastValues.get(subId) ?? { bid: 0, ask: 0, mid: 0 };

        if (pt) {
          // Ноль — сентинел «нет котировки», а не валидная цена: форвард-филлим prev.
          const rawBid = pt['bidPrice'];
          const rawAsk = pt['askPrice'];
          const bid = typeof rawBid === 'number' && rawBid > 0 ? rawBid : prev.bid;
          const ask = typeof rawAsk === 'number' && rawAsk > 0 ? rawAsk : prev.ask;
          let mid = pt['midPrice'] ?? 0;
          if (mid === 0 && bid > 0 && ask > 0) mid = (bid + ask) / 2;
          else if (mid === 0 && bid > 0) mid = bid;
          else if (mid === 0 && ask > 0) mid = ask;
          lastValues.set(subId, { bid, ask, mid });
        }
        // Если нет данных для этого time — prev остаётся (forward-fill)
      }

      // Извлекаем trading bid/ask
      const trading = lastValues.get(tradingSubId) ?? { bid: 0, ask: 0, mid: 0 };

      // Рассчитываем avg reference mid
      let refSum = 0;
      let refCount = 0;
      for (const refId of referenceSubIds) {
        const ref = lastValues.get(refId);
        if (ref && ref.mid > 0) {
          refSum += ref.mid;
          refCount++;
        }
      }
      const avgRefMid = refCount > 0 ? refSum / refCount : 0;

      ticks.push({
        time,
        index: i,
        tradingBid: trading.bid,
        tradingAsk: trading.ask,
        avgRefMid,
      });
    }

    return ticks;
  }
}

