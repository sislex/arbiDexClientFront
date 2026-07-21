import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot } from './entities/bot.entity';
import { BotTrade } from './entities/bot-trade.entity';
import { BotSession } from './entities/bot-session.entity';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';
import { limitEvalSteps, MAX_BOT_EVAL_STEPS } from './bot-eval.constants';
import { MarketConfigsService } from '../market-configs/market-configs.service';
import { StrategyConfigsService } from '../strategy-configs/strategy-configs.service';
import { runAutotuneParallel, estimateGrid, applyCombo, collectDimensions, sampleGrid, sampleRandom } from '../demo/engine/autotune';
import { AutotuneJobsService, AutotuneJobSnapshot, SearchType } from './autotune-jobs.service';
import * as os from 'os';
import { findMarket } from '../demo/engine/markets';
import { BacktestResult, AutotuneResult, Trade, QuotePoint } from '../demo/engine/types';
import { toEngineStrategy } from '../demo/engine/strategy-engine.mapper';
import { injectTradeEventsIntoSteps } from '../demo/engine/inject-trade-events';
import {
  runBacktest,
  processStep,
  prepareSteps,
  processAllStepsAndRecordResults,
} from '@sislex/arbi-conditions-libs';
import type {
  MarketStep,
  PositionState,
  ProcessAllStepsAndRecordResultsOutput,
  TradingConditionsStepResult,
} from '@sislex/arbi-conditions-libs';
/** Per-step engine breakdown recorded during a backtest run. */
export interface BacktestStepRecord {
  index: number;
  time: number;
  result: TradingConditionsStepResult;
}

/** Result of a bot backtest: the demo `BacktestResult` plus the resolved window. */
export interface BotBacktestResult extends BacktestResult {
  historyFrom: number;
  historyTo: number;
  /** Engine dry run over every step (processAllStepsAndRecordResults) — the
   * frontend works with this output to show per-step condition breakdowns. */
  stepResults: ProcessAllStepsAndRecordResultsOutput;
  /** Server-side computation time, ms (data load + engine run). */
  tookMs: number;
  /** Steps after applying MAX_BOT_EVAL_STEPS cap (may be less than raw quote count). */
  evaluatedSteps: number;
  /** True when quotes were trimmed to MAX_BOT_EVAL_STEPS before evaluation. */
  stepsTruncated: boolean;
}

/** Engine evaluation of a single step: signals + per-condition breakdown. */
export interface BotStepResult extends TradingConditionsStepResult {
  /** The resolved (nearest ≤ time) step the strategy was evaluated on. */
  step: QuotePoint;
  /** Index of the evaluated step within the history (0-based). */
  index: number;
  /** Steps available up to the evaluated time (lookback window incl. the step). */
  totalSteps: number;
  /** Steps actually fed into processStep (window sized by the bot's conditions). */
  windowSteps: number;
  historyFrom: number;
  historyTo: number;
  /** Server-side computation time, ms. */
  tookMs: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Итоги live-торговли по журналу сделок за окно сессии. */
export interface BotLiveStats {
  /** Успешные live-сделки (покупки + продажи). */
  tradesCount: number;
  /** Зафейленные попытки (проскальзывание, нет средств, сбой данных…). */
  failedCount: number;
  /** Реализованный PnL — сумма PnL закрывающих продаж, в валюте баланса. */
  pnl: number;
  /** PnL в процентах от стартового депозита (initialBalance). */
  pnlPct: number;
}

/** Сессия с посчитанными по журналу итогами. */
export interface BotSessionWithStats extends BotSession, BotLiveStats {
  /** Сессия активна (endedAt = 0). */
  active: boolean;
}

@Injectable()
export class BotsService {
  constructor(
    @InjectRepository(Bot)
    private readonly repo: Repository<Bot>,
    @InjectRepository(BotTrade)
    private readonly tradesRepo: Repository<BotTrade>,
    @InjectRepository(BotSession)
    private readonly sessionsRepo: Repository<BotSession>,
    private readonly marketConfigs: MarketConfigsService,
    private readonly strategyConfigs: StrategyConfigsService,
    private readonly autotuneJobs: AutotuneJobsService,
  ) {}

  /** Подставляет события сделок из журнала бота — нужно для transaction_delay_ok на live-графике. */
  private async injectBotTradesIntoSteps(
    botId: string,
    steps: MarketStep[],
    upToTime: number,
  ): Promise<void> {
    const trades = await this.tradesRepo.find({
      where: { botId, status: 'success' },
      order: { time: 'ASC' },
    });
    injectTradeEventsIntoSteps(steps, trades, upToTime);
  }

  /** Journal trades → step events (transaction_delay_ok, no_transaction_in_progress). */
  async enrichStepsWithTrades(botId: string, steps: MarketStep[], upToTime: number): Promise<void> {
    await this.injectBotTradesIntoSteps(botId, steps, upToTime);
  }

  /** Итоги торговли по журналу за окно времени [from, to] (unix ms). */
  private async tradeStats(botId: string, from: number, to: number, initialBalance: number): Promise<BotLiveStats> {
    const r: { trades: string; failed: string; pnl: string | null } | undefined =
      await this.tradesRepo
        .createQueryBuilder('t')
        .select(`COUNT(*) FILTER (WHERE t.status = 'success')`, 'trades')
        .addSelect(`COUNT(*) FILTER (WHERE t.status = 'failed')`, 'failed')
        .addSelect(`COALESCE(SUM(t.pnl) FILTER (WHERE t.status = 'success'), 0)`, 'pnl')
        .where('t.botId = :botId AND t.time >= :from AND t.time <= :to', { botId, from, to })
        .getRawOne();
    const pnl = Number(r?.pnl ?? 0);
    return {
      tradesCount: Number(r?.trades ?? 0),
      failedCount: Number(r?.failed ?? 0),
      pnl,
      pnlPct: initialBalance > 0 ? (pnl / initialBalance) * 100 : 0,
    };
  }

  private withStats(s: BotSession, stats: BotLiveStats): BotSessionWithStats {
    return { ...s, ...stats, active: s.endedAt === 0 };
  }

  /** Активная сессия бота, если есть. */
  private activeSession(botId: string): Promise<BotSession | null> {
    return this.sessionsRepo.findOne({ where: { botId, endedAt: 0 }, order: { startedAt: 'DESC' } });
  }

  /** Закрыть активные сессии бота (остановка / повторный запуск). */
  async closeSessions(botId: string, at = Date.now()): Promise<void> {
    await this.sessionsRepo.update({ botId, endedAt: 0 }, { endedAt: at });
  }

  /** Открыть новую сессию (бот переведён в running). */
  async openSession(bot: Bot, at = Date.now()): Promise<BotSession> {
    await this.closeSessions(bot.id, at);
    return this.sessionsRepo.save(
      this.sessionsRepo.create({
        userId: bot.userId,
        botId: bot.id,
        startedAt: at,
        endedAt: 0,
        startBalance: bot.balance,
        mode: bot.mode,
      }),
    );
  }

  /**
   * Гарантировать активную сессию у запущенного бота — для ботов, запущенных
   * до появления сессий (движок вызывает на каждом тике, лишних записей нет).
   */
  async ensureSession(bot: Bot): Promise<void> {
    const active = await this.activeSession(bot.id);
    if (!active) {
      await this.openSession(bot, bot.startedAt > 0 ? bot.startedAt : Date.now());
    }
  }

  /** Сессии бота (новые сверху) с итогами по журналу сделок. */
  async listSessions(userId: string, botId: string): Promise<BotSessionWithStats[]> {
    const bot = await this.findOne(userId, botId);
    const sessions = await this.sessionsRepo.find({ where: { botId }, order: { startedAt: 'DESC' } });
    return Promise.all(
      sessions.map(async (s) =>
        this.withStats(s, await this.tradeStats(botId, s.startedAt, s.endedAt || Date.now(), bot.initialBalance)),
      ),
    );
  }

  /** Одна сессия с итогами. */
  async getSession(userId: string, botId: string, sessionId: string): Promise<BotSessionWithStats> {
    const bot = await this.findOne(userId, botId);
    const s = await this.sessionsRepo.findOne({ where: { id: sessionId, botId } });
    if (!s) throw new NotFoundException('Сессия не найдена');
    return this.withStats(s, await this.tradeStats(botId, s.startedAt, s.endedAt || Date.now(), bot.initialBalance));
  }

  /**
   * Список ботов + итоги ТЕКУЩЕЙ сессии (для остановленных — последней) по
   * журналу сделок. Агрегаты в записи бота исторически смешивали бэктесты и
   * live, поэтому для «результатов торговли» считаем только журнал.
   */
  async findAll(userId: string): Promise<(Bot & { live: BotLiveStats & { sessionId: string | null; sessionStartedAt: number | null; sessionActive: boolean } })[]> {
    const bots = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return Promise.all(
      bots.map(async (b) => {
        const session =
          (await this.activeSession(b.id)) ??
          (await this.sessionsRepo.findOne({ where: { botId: b.id }, order: { startedAt: 'DESC' } }));
        const stats = session
          ? await this.tradeStats(b.id, session.startedAt, session.endedAt || Date.now(), b.initialBalance)
          : { tradesCount: 0, failedCount: 0, pnl: 0, pnlPct: 0 };
        return {
          ...b,
          live: {
            ...stats,
            sessionId: session?.id ?? null,
            sessionStartedAt: session?.startedAt ?? null,
            sessionActive: session ? session.endedAt === 0 : false,
          },
        };
      }),
    );
  }

  async findOne(userId: string, id: string): Promise<Bot> {
    const bot = await this.repo.findOne({ where: { id, userId } });
    if (!bot) throw new NotFoundException('Бот не найден');
    return bot;
  }

  async create(userId: string, dto: CreateBotDto): Promise<Bot> {
    // Derive traded assets from the market config's trading market when absent.
    let baseAsset = dto.baseAsset;
    let quoteAsset = dto.quoteAsset;
    if (!baseAsset || !quoteAsset) {
      const mc = await this.marketConfigs.findOne(userId, dto.marketConfigId);
      const market = mc.tradingMarketId ? findMarket(mc.tradingMarketId) : undefined;
      baseAsset = baseAsset ?? market?.base ?? 'WETH';
      quoteAsset = quoteAsset ?? market?.quote ?? 'USDC';
    }
    const initialBalance = dto.initialBalance ?? 1000;
    const bot = this.repo.create({
      userId,
      name: dto.name,
      status: dto.status ?? 'stopped',
      mode: dto.mode ?? 'idle',
      marketConfigId: dto.marketConfigId,
      strategyConfigId: dto.strategyConfigId,
      baseAsset,
      quoteAsset,
      initialBalance,
      slippagePct: dto.slippagePct ?? 0.5,
      balance: initialBalance,
      pnl: 0,
      pnlPct: 0,
      tradesCount: 0,
      winRate: 0,
      openPosition: false,
    });
    return this.repo.save(bot);
  }

  async update(userId: string, id: string, dto: UpdateBotDto): Promise<Bot> {
    const bot = await this.findOne(userId, id);
    // Смена начального баланса или валюты баланса (quoteAsset) перезапускает
    // демосчёт: старые balance/позиция выражены в прежней валюте.
    const resetAccount =
      (dto.initialBalance !== undefined && dto.initialBalance !== bot.initialBalance) ||
      (dto.quoteAsset !== undefined && dto.quoteAsset !== bot.quoteAsset);
    // ValidationPipe(transform) создаёт DTO со ВСЕМИ объявленными полями —
    // непереданные равны undefined и затирали бота (balance и т.п. пропадали
    // из ответа, фронт падал). Копируем только реально переданные значения.
    const patch = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    // Переходы статуса управляют сессиями: запуск открывает новую сессию,
    // остановка закрывает активную. startedAt — начало текущей сессии.
    const starting = dto.status === 'running' && bot.status !== 'running';
    const stopping = dto.status !== undefined && dto.status !== 'running' && bot.status === 'running';
    if (starting) bot.startedAt = Date.now();
    Object.assign(bot, patch);
    if (resetAccount && dto.balance === undefined) {
      bot.balance = bot.initialBalance;
      bot.positionSize = 0;
      bot.entryPrice = 0;
      bot.openPosition = false;
      bot.pnl = 0;
      bot.pnlPct = 0;
    }
    const saved = await this.repo.save(bot);
    if (starting) await this.openSession(saved, saved.startedAt);
    if (stopping) await this.closeSessions(saved.id);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const bot = await this.findOne(userId, id);
    await this.repo.remove(bot);
  }

  /** Available history bounds for the bot's linked market (for period selection). */
  async historyRange(userId: string, id: string): Promise<{ historyFrom: number; historyTo: number }> {
    const bot = await this.findOne(userId, id);
    return this.marketConfigs.getHistoryRange(userId, bot.marketConfigId);
  }

  /**
   * Real historical quotes of the bot's market over `[from, to]` WITHOUT running
   * a backtest — for previewing the period on a chart. Same window semantics as
   * `backtest` (defaults to the last week, clamped to the available history).
   * `refresh` re-fetches every market of the config from market-data, bypassing
   * the server-side quotes cache, before reading.
   */
  async quotesRange(
    userId: string,
    id: string,
    opts: { from?: number; to?: number; refresh?: boolean } = {},
  ): Promise<{ quotes: QuotePoint[]; from: number; to: number; historyFrom: number; historyTo: number }> {
    const bot = await this.findOne(userId, id);
    if (opts.refresh) await this.marketConfigs.refreshQuotesCache(userId, bot.marketConfigId);

    const { historyFrom, historyTo } = await this.marketConfigs.getHistoryRange(
      userId,
      bot.marketConfigId,
    );
    const week = historyTo > 1e12 ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600;
    const to = clamp(opts.to ?? historyTo, historyFrom, historyTo);
    const from = clamp(opts.from ?? to - week, historyFrom, to);

    const { quotes } = await this.marketConfigs.getQuotesRange(userId, bot.marketConfigId, from, to);
    return { quotes, from, to, historyFrom, historyTo };
  }

  /**
   * Load the bot's linked strategy, turning a missing (e.g. deleted) strategy into
   * a clear, actionable error instead of a bare "not found".
   */
  private async loadStrategy(userId: string, bot: Bot) {
    try {
      return await this.strategyConfigs.findOne(userId, bot.strategyConfigId);
    } catch {
      throw new NotFoundException(
        'У бота не привязана стратегия (возможно, она была удалена). Откройте бота и выберите стратегию, затем повторите.',
      );
    }
  }

  /**
   * Run a strategy backtest over `[from, to]` on the bot's linked market and fold
   * the result into its demo account. Drives the shared engine
   * (`@sislex/arbi-conditions-libs`) on real historical quotes.
   *
   * `to` defaults to the end of available history; `from` defaults to one week
   * before `to`. Both are clamped to the available range.
   */
  async backtest(
    userId: string,
    id: string,
    opts: { from?: number; to?: number; params?: Record<string, number> } = {},
  ): Promise<BotBacktestResult> {
    const startedAt = Date.now();
    const bot = await this.findOne(userId, id);

    const { historyFrom, historyTo } = await this.marketConfigs.getHistoryRange(
      userId,
      bot.marketConfigId,
    );
    // "One week" in the data's own time unit (seconds vs ms).
    const week = historyTo > 1e12 ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600;
    const to = clamp(opts.to ?? historyTo, historyFrom, historyTo);
    const from = clamp(opts.from ?? to - week, historyFrom, to);

    const { quotes: rawQuotes } = await this.marketConfigs.getQuotesRange(userId, bot.marketConfigId, from, to);
    const quotes = limitEvalSteps(rawQuotes);
    const stepsTruncated = rawQuotes.length > MAX_BOT_EVAL_STEPS;
    const strategy = await this.loadStrategy(userId, bot);
    // Опциональные коэффициенты комбо (строка автоподбора) поверх стратегии.
    const strategyData =
      opts.params && Object.keys(opts.params).length > 0
        ? applyCombo({ buy: strategy.buy, sell: strategy.sell }, opts.params)
        : { buy: strategy.buy, sell: strategy.sell };
    const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(strategyData.buy, strategyData.sell);

    const steps: MarketStep[] = quotes.map((q) => ({
      time: q.time,
      quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
    }));

    const engineResult = runBacktest(steps, engineStrategy, {
      initialBalance: bot.initialBalance,
      conditions: gates,
      triggerConditions: triggers,
      id: `bt_${bot.id}`,
    });

    // Canonical per-step breakdown for the UI: a positionless dry run of the
    // engine over every step (ProcessAllStepsAndRecordResultsOutput).
    const stepResults = processAllStepsAndRecordResults({
      steps,
      strategy: engineStrategy,
      conditions: gates,
      triggerConditions: triggers,
    });

    const trades: Trade[] = engineResult.trades.map((t) => ({
      id: t.id,
      time: t.time,
      side: t.side,
      price: t.price,
      amount: t.amount,
      pnl: t.pnl,
      reason: t.reason,
    }));

    const result: BotBacktestResult = {
      id: engineResult.id,
      from,
      to,
      quotes,
      trades,
      stats: engineResult.stats,
      historyFrom,
      historyTo,
      stepResults,
      tookMs: Date.now() - startedAt,
      evaluatedSteps: quotes.length,
      stepsTruncated,
    };

    // Update the demo account — но НЕ у запущенного live-бота: его счётом
    // владеет движок live-торговли, бэктест затирал бы реальную позицию.
    const liveRunning =
      bot.status === 'running' && (bot.mode === 'demo-live' || bot.mode === 'real-live');
    if (!liveRunning) {
      bot.balance = result.stats.finalBalance;
      bot.pnl = result.stats.pnl;
      bot.pnlPct = result.stats.pnlPct;
      bot.tradesCount = result.stats.trades;
      bot.winRate = result.stats.winRate;
      bot.openPosition = false;
      await this.repo.save(bot);
    }
    return result;
  }

  /**
   * Evaluate the bot's strategy on a SINGLE step: the step at (or nearest before)
   * `time`, with all earlier history feeding the lookback conditions. Returns the
   * engine's full per-condition breakdown (`condition.buy/sell` with
   * actual/required) and the resulting signals (`transaction.buy/sell/forcedSell`).
   *
   * Read-only: does not touch the bot's demo account. Sell triggers (stop-loss /
   * trailing TP / max holding) need an open position: pass `entryPrice` (and
   * optionally `openedAt`) to simulate one, otherwise the bot's real open
   * position is used; with no position at all they report `passed: false`.
   */
  async stepResult(
    userId: string,
    id: string,
    opts: { time?: number; entryPrice?: number; openedAt?: number; size?: number } = {},
  ): Promise<BotStepResult> {
    const startedAt = Date.now();
    const bot = await this.findOne(userId, id);

    const { historyFrom, historyTo } = await this.marketConfigs.getHistoryRange(
      userId,
      bot.marketConfigId,
    );
    const time = clamp(opts.time ?? historyTo, historyFrom, historyTo);

    // All history up to the requested time: the last point is the evaluated
    // step, everything before it is the lookback window.
    const { quotes: rawQuotes } = await this.marketConfigs.getQuotesRange(userId, bot.marketConfigId, historyFrom, time);
    if (rawQuotes.length === 0) {
      throw new NotFoundException('Нет котировок до указанного времени');
    }
    const quotes = limitEvalSteps(rawQuotes);

    const strategy = await this.loadStrategy(userId, bot);
    const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(strategy.buy, strategy.sell);

    const steps: MarketStep[] = quotes.map((q) => ({
      time: q.time,
      quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
    }));

    await this.injectBotTradesIntoSteps(bot.id, steps, time);

    // Позиция: явная (симуляция из плеера бэктеста) или реальная позиция
    // бота — иначе sell-триггеры (стоп-лосс/trailing TP) на live-вкладке
    // всегда показывали «нет позиции», а buy-сигнал выглядел исполнимым.
    const position: PositionState | null =
      opts.entryPrice != null
        ? {
            entryPrice: opts.entryPrice,
            size: opts.size ?? 0,
            openedAt: opts.openedAt ?? steps[0].time,
          }
        : bot.openPosition && bot.positionSize > 0
          ? {
              entryPrice: bot.entryPrice,
              size: bot.positionSize,
              openedAt: bot.positionOpenedAt > 0 ? bot.positionOpenedAt : steps[0].time,
            }
          : null;

    // prepareSteps trims the history down to the minimal window the bot's
    // conditions actually need (max over their WindowRequirements).
    const params = prepareSteps({
      steps,
      strategy: engineStrategy,
      position,
      conditions: gates,
      triggerConditions: triggers,
    });
    const result = processStep(params);

    return {
      ...result,
      step: quotes[quotes.length - 1],
      index: quotes.length - 1,
      totalSteps: quotes.length,
      windowSteps: params.steps.length,
      historyFrom,
      historyTo,
      tookMs: Date.now() - startedAt,
    };
  }

  /**
   * Auto-tune the strategy's tunable coefficients over `[from, to]` (same window
   * semantics and engine as `backtest`). Ranks parameter combinations by PnL.
   */
  async autotune(
    userId: string,
    id: string,
    opts: { from?: number; to?: number; maxCombos?: number; threads?: number; initialBalance?: number } = {},
  ): Promise<AutotuneResult & { tookMs: number }> {
    const startedAt = Date.now();
    const bot = await this.findOne(userId, id);

    const { historyFrom, historyTo } = await this.marketConfigs.getHistoryRange(
      userId,
      bot.marketConfigId,
    );
    const week = historyTo > 1e12 ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600;
    const to = clamp(opts.to ?? historyTo, historyFrom, historyTo);
    const from = clamp(opts.from ?? to - week, historyFrom, to);

    const { quotes } = await this.marketConfigs.getQuotesRange(userId, bot.marketConfigId, from, to);
    const strategy = await this.loadStrategy(userId, bot);
    const result = await runAutotuneParallel(quotes, { buy: strategy.buy, sell: strategy.sell }, {
      maxCombos: opts.maxCombos ?? 1000,
      initialBalance: opts.initialBalance ?? bot.initialBalance,
      id: `at_${bot.id}`,
      threads: opts.threads,
    });
    return { ...result, tookMs: Date.now() - startedAt };
  }

  /** Потоков перебора — та же формула, что в runAutotuneParallel. */
  private autotuneThreads(threads?: number): number {
    const cores = os.availableParallelism?.() ?? os.cpus().length;
    return Math.max(1, threads ?? Math.min(6, cores - 1));
  }

  /**
   * Оценка автоподбора БЕЗ перебора: размер сетки комбинаций, сколько прогонов
   * реально будет выполнено и прогноз времени — один бэктест по текущим
   * коэффициентам, умноженный на число прогонов с учётом потоков.
   */
  async autotuneEstimate(
    userId: string,
    id: string,
    opts: { from?: number; to?: number; maxCombos?: number; threads?: number; searchType?: SearchType } = {},
  ): Promise<{
    gridTotal: number;
    combosToRun: number;
    dimensions: number;
    steps: number;
    singleRunMs: number;
    threads: number;
    estimatedMs: number;
    from: number;
    to: number;
    searchType: SearchType;
    /** Для уточняющего перебора: раундов и прогонов в раунде. */
    rounds: number | null;
    roundSize: number | null;
    /** Сколько заняла сама оценка (загрузка данных + один бэктест). */
    tookMs: number;
  }> {
    const estimateStartedAt = Date.now();
    const bot = await this.findOne(userId, id);
    const { historyFrom, historyTo } = await this.marketConfigs.getHistoryRange(
      userId,
      bot.marketConfigId,
    );
    const week = historyTo > 1e12 ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600;
    const to = clamp(opts.to ?? historyTo, historyFrom, historyTo);
    const from = clamp(opts.from ?? to - week, historyFrom, to);

    const { quotes } = await this.marketConfigs.getQuotesRange(userId, bot.marketConfigId, from, to);
    const strategy = await this.loadStrategy(userId, bot);
    const { gridTotal, combosToRun, dimensions } = estimateGrid(
      { buy: strategy.buy, sell: strategy.sell },
      opts.maxCombos ?? 1000,
    );

    // Один пробный бэктест по текущим коэффициентам — цена одного прогона.
    const steps: MarketStep[] = quotes.map((q) => ({
      time: q.time,
      quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
    }));
    const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(strategy.buy, strategy.sell);
    const t0 = Date.now();
    runBacktest(steps, engineStrategy, {
      initialBalance: bot.initialBalance,
      conditions: gates,
      triggerConditions: triggers,
      id: `est_${bot.id}`,
    });
    const singleRunMs = Math.max(1, Date.now() - t0);

    const threads = this.autotuneThreads(opts.threads);
    const estimatedMs = Math.ceil(combosToRun / threads) * singleRunMs;
    // Уточняющий перебор гоняет тот же бюджет прогонов, но раундами — время
    // оценивается так же; отдаём разбивку на раунды для подсказки в UI.
    const searchType: SearchType =
      opts.searchType === 'refine' ? 'refine' : opts.searchType === 'random' ? 'random' : 'grid';
    const rounds = searchType === 'refine' ? 3 : null;
    const roundSize = searchType === 'refine' ? Math.max(1, Math.ceil(combosToRun / 3)) : null;

    return {
      gridTotal,
      combosToRun,
      dimensions,
      steps: quotes.length,
      singleRunMs,
      threads,
      estimatedMs,
      from,
      to,
      searchType,
      rounds,
      roundSize,
      tookMs: Date.now() - estimateStartedAt,
    };
  }

  /**
   * Фоновый автоподбор: сразу возвращает jobId, задача попадает в общий
   * планировщик расчётов (пул потоков + очередь + пауза/резюме) — фронт
   * получает прогресс раз в секунду по вебсокету /autotune-progress.
   */
  async autotuneStart(
    userId: string,
    id: string,
    opts: {
      from?: number;
      to?: number;
      maxCombos?: number;
      threads?: number;
      initialBalance?: number;
      searchType?: SearchType;
    } = {},
  ): Promise<AutotuneJobSnapshot> {
    const bot = await this.findOne(userId, id);
    const { historyFrom, historyTo } = await this.marketConfigs.getHistoryRange(
      userId,
      bot.marketConfigId,
    );
    const week = historyTo > 1e12 ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600;
    const to = clamp(opts.to ?? historyTo, historyFrom, historyTo);
    const from = clamp(opts.from ?? to - week, historyFrom, to);

    const { quotes } = await this.marketConfigs.getQuotesRange(userId, bot.marketConfigId, from, to);
    const strategy = await this.loadStrategy(userId, bot);
    const strategyData = { buy: strategy.buy, sell: strategy.sell };

    const searchType: SearchType =
      opts.searchType === 'refine' ? 'refine' : opts.searchType === 'random' ? 'random' : 'grid';
    const maxCombos = opts.maxCombos ?? 1000;

    const dims = collectDimensions(strategyData);
    const gridTotal = dims.length ? estimateGrid(strategyData, maxCombos).gridTotal : 1;
    // Случайный поиск сэмплирует комбинации стохастически, остальные — равномерно.
    const comboParams = !dims.length
      ? [{}]
      : searchType === 'random'
        ? sampleRandom(dims, maxCombos)
        : sampleGrid(dims, maxCombos);

    const steps: MarketStep[] = quotes.map((q) => ({
      time: q.time,
      quotes: { buyQuote: q.buyQuote, sellQuote: q.sellQuote, avgObservedQuote: q.avgObservedQuote },
    }));

    const typeSuffix =
      searchType === 'refine' ? ' (уточняющий)' : searchType === 'random' ? ' (случайный)' : '';
    return this.autotuneJobs.submit({
      userId,
      botId: id,
      label: `${bot.name}: ${comboParams.length.toLocaleString('ru-RU')} прогонов${typeSuffix}`,
      comboParams,
      gridTotal,
      dims,
      steps,
      strategy: strategyData,
      params: {
        from,
        to,
        maxCombos,
        initialBalance: opts.initialBalance ?? bot.initialBalance,
        threads: opts.threads,
        searchType,
      },
      initialBalance: opts.initialBalance ?? bot.initialBalance,
      threads: opts.threads,
    });
  }
}
