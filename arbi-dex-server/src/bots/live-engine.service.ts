import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Bot } from './entities/bot.entity';
import { LiveTradingService } from './live-trading.service';
import { MarketConfigsService } from '../market-configs/market-configs.service';
import { StrategyConfigsService } from '../strategy-configs/strategy-configs.service';
import { toEngineStrategy } from '../demo/engine/strategy-engine.mapper';
import { prepareSteps, processStep } from '@sislex/arbi-conditions-libs';
import type { MarketStep, PositionState } from '@sislex/arbi-conditions-libs';

/** Период тика движка: раз в N мс каждый запущенный live-бот оценивает стратегию. */
const TICK_MS = 30_000;
/** Пауза бота после неудачной сделки, чтобы не ретраить каждый тик. */
const FAIL_COOLDOWN_MS = 120_000;

/**
 * Движок автономной live-торговли: каждые TICK_MS для каждого бота со статусом
 * `running` и режимом demo-live/real-live прогоняет стратегию (processStep) по
 * последним реальным котировкам его рынка и исполняет сигналы через
 * LiveTradingService.trade:
 *
 * - buy-сигнал без открытой позиции → покупка (демо: квотер, реал: executor);
 * - sell/forcedSell-сигнал с открытой позицией → продажа;
 * - на один и тот же шаг котировок бот не реагирует дважды;
 * - реальные сделки ограничены эквивалентом 1 USDC (внутри trade()).
 *
 * Демо- и реал-боты идут через один и тот же код и одну модель позиции —
 * различие только в исполнении сделки, что и позволяет сравнивать их лоб в лоб.
 */
@Injectable()
export class LiveEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveEngineService.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  /** botId → время шага, на который бот уже отреагировал (или пропустил). */
  private readonly lastActedStep = new Map<string, number>();
  /** botId → до какого момента бот не торгует после неудачной сделки. */
  private readonly cooldownUntil = new Map<string, number>();

  constructor(
    @InjectRepository(Bot)
    private readonly botsRepo: Repository<Bot>,
    private readonly liveTrading: LiveTradingService,
    private readonly marketConfigs: MarketConfigsService,
    private readonly strategyConfigs: StrategyConfigsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
    this.logger.log(`Движок live-торговли запущен (тик ${TICK_MS / 1000} с)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Один проход по всем запущенным live-ботам. */
  async tick(): Promise<void> {
    if (this.busy) return; // предыдущий проход ещё идёт
    this.busy = true;
    try {
      const bots = await this.botsRepo.find({
        where: { status: 'running', mode: In(['demo-live', 'real-live']) },
      });
      // Кэш котировок живёт час — без принудительного обновления движок не
      // увидит новых шагов. Обновляем каждую конфигурацию рынка один раз за тик.
      const refreshed = new Set<string>();
      for (const bot of bots) {
        const key = `${bot.userId}|${bot.marketConfigId}`;
        if (refreshed.has(key)) continue;
        refreshed.add(key);
        try {
          await this.marketConfigs.refreshQuotesCache(bot.userId, bot.marketConfigId);
        } catch (e) {
          this.logger.warn(`Кэш котировок ${bot.marketConfigId}: ${(e as Error).message}`);
        }
      }
      for (const bot of bots) {
        try {
          await this.stepBot(bot);
        } catch (e) {
          this.logger.warn(`Бот ${bot.name}: тик не удался — ${(e as Error).message}`);
        }
      }
    } finally {
      this.busy = false;
    }
  }

  /** Оценка стратегии бота на последнем шаге котировок + исполнение сигнала. */
  private async stepBot(bot: Bot): Promise<void> {
    // После неудачной сделки (нет средств на executor, проскальзывание…) бот
    // выдерживает паузу, чтобы не забивать журнал ретраями каждый тик.
    if (Date.now() < (this.cooldownUntil.get(bot.id) ?? 0)) return;

    const { quotes } = await this.marketConfigs.getQuotesRange(bot.userId, bot.marketConfigId);
    if (quotes.length === 0) return;
    const last = quotes[quotes.length - 1];

    // Новых шагов с прошлой реакции не было — сигнал уже отработан/отклонён.
    if (this.lastActedStep.get(bot.id) === last.time) return;

    const strategy = await this.strategyConfigs.findOne(bot.userId, bot.strategyConfigId);
    const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(strategy.buy, strategy.sell);

    const steps: MarketStep[] = quotes.map((q) => ({
      time: q.time,
      quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
    }));
    const position: PositionState | null = bot.openPosition
      ? {
          entryPrice: bot.entryPrice,
          size: bot.positionSize,
          openedAt: bot.positionOpenedAt > 0 ? bot.positionOpenedAt : steps[0].time,
        }
      : null;

    const params = prepareSteps({
      steps,
      strategy: engineStrategy,
      position,
      conditions: gates,
      triggerConditions: triggers,
    });
    const result = processStep(params);
    this.lastActedStep.set(bot.id, last.time);

    const wantBuy = result.transaction.buy && !bot.openPosition && bot.balance > 0;
    const wantSell = (result.transaction.sell || result.transaction.forcedSell) && bot.openPosition;
    if (!wantBuy && !wantSell) return;

    const side = wantBuy ? 'buy' : 'sell';
    const expectedPrice = side === 'buy' ? last.buyQuote : last.sellQuote;
    this.logger.log(
      `Бот ${bot.name} (${bot.mode}): сигнал ${side}${result.transaction.forcedSell ? ' (forced)' : ''} по ${expectedPrice}`,
    );
    const { trade } = await this.liveTrading.trade(bot.userId, bot.id, { side, expectedPrice });
    this.logger.log(
      `Бот ${bot.name}: сделка ${side} → ${trade.status}${trade.price != null ? ` по ${trade.price}` : ''}${trade.error ? ` (${trade.error})` : ''}`,
    );
    if (trade.status === 'failed') {
      this.cooldownUntil.set(bot.id, Date.now() + FAIL_COOLDOWN_MS);
    }
  }
}
