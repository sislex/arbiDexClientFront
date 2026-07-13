import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot } from './entities/bot.entity';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';
import { MarketConfigsService } from '../market-configs/market-configs.service';
import { StrategyConfigsService } from '../strategy-configs/strategy-configs.service';
import { runAutotune } from '../demo/engine/autotune';
import { findMarket } from '../demo/engine/markets';
import { BacktestResult, AutotuneResult, Trade } from '../demo/engine/types';
import { toEngineStrategy } from '../demo/engine/strategy-engine.mapper';
import { runBacktest } from '@sislex/arbi-conditions-libs';
import type { MarketStep } from '@sislex/arbi-conditions-libs';

/** Result of a bot backtest: the demo `BacktestResult` plus the resolved window. */
export interface BotBacktestResult extends BacktestResult {
  historyFrom: number;
  historyTo: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

@Injectable()
export class BotsService {
  constructor(
    @InjectRepository(Bot)
    private readonly repo: Repository<Bot>,
    private readonly marketConfigs: MarketConfigsService,
    private readonly strategyConfigs: StrategyConfigsService,
  ) {}

  findAll(userId: string): Promise<Bot[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
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
    Object.assign(bot, dto);
    return this.repo.save(bot);
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
    opts: { from?: number; to?: number } = {},
  ): Promise<BotBacktestResult> {
    const bot = await this.findOne(userId, id);

    const { historyFrom, historyTo } = await this.marketConfigs.getHistoryRange(
      userId,
      bot.marketConfigId,
    );
    // "One week" in the data's own time unit (seconds vs ms).
    const week = historyTo > 1e12 ? 7 * 24 * 3600 * 1000 : 7 * 24 * 3600;
    const to = clamp(opts.to ?? historyTo, historyFrom, historyTo);
    const from = clamp(opts.from ?? to - week, historyFrom, to);

    const { quotes } = await this.marketConfigs.getQuotesRange(userId, bot.marketConfigId, from, to);
    const strategy = await this.loadStrategy(userId, bot);
    const { strategy: engineStrategy, gates, triggers } = toEngineStrategy(strategy.buy, strategy.sell);

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
    };

    // Update the demo account.
    bot.balance = result.stats.finalBalance;
    bot.pnl = result.stats.pnl;
    bot.pnlPct = result.stats.pnlPct;
    bot.tradesCount = result.stats.trades;
    bot.winRate = result.stats.winRate;
    bot.openPosition = false;
    await this.repo.save(bot);
    return result;
  }

  /**
   * Auto-tune the strategy's tunable coefficients over `[from, to]` (same window
   * semantics and engine as `backtest`). Ranks parameter combinations by PnL.
   */
  async autotune(
    userId: string,
    id: string,
    opts: { from?: number; to?: number; maxCombos?: number } = {},
  ): Promise<AutotuneResult> {
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
    return runAutotune(quotes, { buy: strategy.buy, sell: strategy.sell }, {
      maxCombos: opts.maxCombos ?? 48,
      initialBalance: bot.initialBalance,
      id: `at_${bot.id}`,
    });
  }
}
