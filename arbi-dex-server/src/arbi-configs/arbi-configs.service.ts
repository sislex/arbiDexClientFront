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
import { BacktestEngine, BacktestTick, BacktestResult } from './engine/backtest.engine';
import {
  evaluateConditions,
  decideAction,
  StepQuotes,
  StepAnalytics,
  ConditionStat,
  BacktestAnalyticsSummary,
  AnalyticsConditionsConfig,
} from './analytics/trade-analytics.helper';
import conditionsConfigJson from './analytics/conditions.config.json';

/**
 * Результат новой реализации бэктеста: обычный BacktestResult + сводная аналитика.
 *
 * ВАЖНО: полный массив пошаговой аналитики НЕ отдаётся (точек могут быть сотни тысяч —
 * это вешает браузер). Возвращаем компактную сводку (`summary`) по всем шагам плюс
 * ограниченную выборку «значимых» шагов (`steps`) — где был сигнал или сделка.
 */
export interface BacktestNewResult extends BacktestResult {
  /** Конфиг условий, по которому считалась аналитика */
  conditions: AnalyticsConditionsConfig['conditions'];
  /** Сводная аналитика по всем шагам (компактная) */
  summary: BacktestAnalyticsSummary;
  /** Выборка «значимых» шагов (сигнал/сделка), ограниченная лимитом */
  steps: StepAnalytics[];
  /** Сколько «значимых» шагов было всего (до обрезки лимитом) */
  significantSteps: number;
  /** Была ли выборка steps обрезана лимитом */
  stepsTruncated: boolean;
}

const conditionsConfig = conditionsConfigJson as AnalyticsConditionsConfig;

/** Максимум «значимых» шагов, отдаваемых в ответе (защита от гигантского payload) */
const STEP_SAMPLE_LIMIT = 2000;

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

    const initialBalance = Number(config.initialBalance ?? 0);
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

    // Строим массив котировок (тиков): time + buyPrice(ask) / sellPrice(bid) / observed
    const ticks = this.buildBacktestTicks(pricesMap, tradingSubId, referenceSubIds);

    // Симуляция + аналитика
    let usdcBalance = initialBalance;
    let wethBalance = 0;
    let hasPosition = false;
    let lastMid = 0;

    const trades: BacktestResult['trades'] = [];
    // Выборка «значимых» шагов (сигнал/сделка), ограниченная лимитом — чтобы не
    // отдавать сотни тысяч точек и не вешать браузер.
    const steps: StepAnalytics[] = [];
    let significantSteps = 0;
    let tradeCounter = 0;

    // Аккумуляторы сводной аналитики по всем шагам
    let buySignals = 0;
    let sellSignals = 0;
    let txAllowedCount = 0;
    const statByCondId = new Map<string, ConditionStat>();

    for (const tick of ticks) {
      const quotes: StepQuotes = {
        observedPrice: tick.avgRefMid,
        buyPrice: tick.tradingAsk,
        sellPrice: tick.tradingBid,
      };

      // Аналитика: какие условия прошли / не прошли
      const conditions = evaluateConditions(quotes, conditionsConfig);
      const decided = decideAction(conditions, hasPosition);

      // Копим статистику по условиям
      let buySignalPassed = false;
      let sellSignalPassed = false;
      for (const c of conditions) {
        let stat = statByCondId.get(c.id);
        if (!stat) {
          stat = { id: c.id, type: c.type, thresholdPct: c.thresholdPct, passedCount: 0, failedCount: 0 };
          statByCondId.set(c.id, stat);
        }
        if (c.passed) stat.passedCount++;
        else stat.failedCount++;

        if (c.passed && c.type === 'OBSERVED_ABOVE_BUY') buySignalPassed = true;
        if (c.passed && c.type === 'OBSERVED_BELOW_SELL') sellSignalPassed = true;
        if (c.passed && c.type === 'SPREAD_WITHIN') txAllowedCount++;
      }
      if (buySignalPassed) buySignals++;
      if (sellSignalPassed) sellSignals++;

      // Текущая mid-цена торгового рынка (для оценки портфеля)
      if (tick.tradingBid > 0 && tick.tradingAsk > 0) {
        lastMid = (tick.tradingBid + tick.tradingAsk) / 2;
      } else if (tick.tradingBid > 0) {
        lastMid = tick.tradingBid;
      } else if (tick.tradingAsk > 0) {
        lastMid = tick.tradingAsk;
      }

      // Исполнение сделок
      let executedAction: StepAnalytics['action'] = 'none';
      if (decided === 'buy' && usdcBalance > 0 && tick.tradingAsk > 0) {
        const amountIn = usdcBalance;
        const amountOut = amountIn / tick.tradingAsk;
        usdcBalance = 0;
        wethBalance += amountOut;
        hasPosition = true;
        executedAction = 'buy';
        trades.push({
          id: ++tradeCounter,
          step: tick.index,
          time: tick.time,
          direction: 'USDC_TO_WETH',
          amountIn: parseFloat(amountIn.toFixed(8)),
          tokenIn: 'USDC',
          amountOut: parseFloat(amountOut.toFixed(8)),
          tokenOut: 'WETH',
          price: tick.tradingAsk,
          slippage: 0,
          reason: conditions.filter((c) => c.passed).map((c) => c.id).join(', '),
        });
      } else if (decided === 'sell' && wethBalance > 0 && tick.tradingBid > 0) {
        const amountIn = wethBalance;
        const amountOut = amountIn * tick.tradingBid;
        wethBalance = 0;
        usdcBalance += amountOut;
        hasPosition = false;
        executedAction = 'sell';
        trades.push({
          id: ++tradeCounter,
          step: tick.index,
          time: tick.time,
          direction: 'WETH_TO_USDC',
          amountIn: parseFloat(amountIn.toFixed(8)),
          tokenIn: 'WETH',
          amountOut: parseFloat(amountOut.toFixed(8)),
          tokenOut: 'USDC',
          price: tick.tradingBid,
          slippage: 0,
          reason: conditions.filter((c) => c.passed).map((c) => c.id).join(', '),
        });
      }

      // «Значимый» шаг — где был сигнал или совершена сделка. Только их кладём в выборку.
      const isSignificant = executedAction !== 'none' || buySignalPassed || sellSignalPassed;
      if (isSignificant) {
        significantSteps++;
        if (steps.length < STEP_SAMPLE_LIMIT) {
          steps.push({
            time: tick.time,
            index: tick.index,
            quotes,
            conditions,
            action: executedAction,
          });
        }
      }
    }

    const portfolioValue = usdcBalance + wethBalance * lastMid;
    const pnl = portfolioValue - initialBalance;
    const pnlPct = initialBalance > 0 ? (pnl / initialBalance) * 100 : 0;

    const summary: BacktestAnalyticsSummary = {
      totalSteps: ticks.length,
      buySignals,
      sellSignals,
      txAllowed: txAllowedCount,
      conditionStats: Array.from(statByCondId.values()),
    };

    const result: BacktestNewResult = {
      finalUsdcBalance: parseFloat(usdcBalance.toFixed(8)),
      finalWethBalance: parseFloat(wethBalance.toFixed(8)),
      portfolioValue: parseFloat(portfolioValue.toFixed(2)),
      initialBalance,
      pnl: parseFloat(pnl.toFixed(2)),
      pnlPct: parseFloat(pnlPct.toFixed(4)),
      totalTrades: trades.length,
      buyCount: trades.filter((t) => t.direction === 'USDC_TO_WETH').length,
      sellCount: trades.filter((t) => t.direction === 'WETH_TO_USDC').length,
      totalPoints: ticks.length,
      trades,
      conditions: conditionsConfig.conditions,
      summary,
      steps,
      significantSteps,
      stepsTruncated: significantSteps > steps.length,
    };

    const elapsed = Date.now() - startMs;
    this.logger.log(
      `Бэктест (new) ${configId}: ${ticks.length} точек, ${result.totalTrades} сделок, ` +
        `значимых шагов: ${significantSteps} (отдано ${steps.length}), ` +
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
          const bid = pt['bidPrice'] ?? prev.bid;
          const ask = pt['askPrice'] ?? prev.ask;
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

