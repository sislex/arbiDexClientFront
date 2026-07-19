import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ethers } from 'ethers';
import { Bot } from './entities/bot.entity';
import { BotTrade, BotTradeMode } from './entities/bot-trade.entity';
import { TradeRequestDto } from './dto/trade.dto';
import { MarketConfigsService } from '../market-configs/market-configs.service';
import { MarketDataService, PoolInfo } from '../market-data/market-data.service';
import { SwapExecutionService } from '../swap-execution/swap-execution.service';
import { SwapQuoterService } from '../swap-execution/swap-quoter.service';
import { ExecuteSwapDto, NetworkPrefix, SwapStepDto } from '../swap-execution/dto/execute-swap.dto';
import { getTokenMeta } from '../swap-execution/token.constants';
import { TradingSettingsService } from '../settings/trading-settings.service';
import { UserTradingContract } from '../settings/entities/user-trading-contract.entity';
import { findMarket } from '../demo/engine/markets';
import type { Side } from '../demo/engine/types';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const erc20Abi = ['function balanceOf(address) view returns (uint256)'] as const;

/** `dex:arbitrum` / `dex_arbitrum` → `ARBITRUM` (NetworkPrefix бэкенда). */
export function networkPrefixFromSource(sourceId: string): NetworkPrefix {
  const sep = sourceId.includes(':') ? ':' : '_';
  const network = sourceId.includes(sep) ? sourceId.split(sep).pop()! : sourceId;
  const prefix = network.toUpperCase();
  if (!(prefix in NetworkPrefix)) {
    throw new BadRequestException(`Сеть «${network}» не поддерживается квотером/экзекутором`);
  }
  return prefix as NetworkPrefix;
}

/**
 * `kind` по enum SwapKind контракта ArbExecutor (зеркало
 * `arbi-dex/.../execute-swap-payload.ts`): V2_EXACT_IN=0, V3_POOL_EXACT_IN=1,
 * CAMELOT_V2_EXACT_IN=2, ALGEBRA_POOL_EXACT_IN=3, V4_POOL_EXACT_IN=4.
 * Camelot различаем по version: V2 → router-based (2), V3/Algebra → pool (3).
 */
export function poolKind(pool: PoolInfo): number {
  const dex = (pool.dex ?? '').toLowerCase();
  const version = (pool.version ?? '').toLowerCase();
  const isCamelot = dex.includes('camelot');
  if (version === 'v2') return isCamelot ? 2 : 0;
  if (version === 'v3') return isCamelot ? 3 : 1;
  if (version === 'v4') return 4;
  return 1;
}

/** Человекочитаемая сумма → raw-единицы токена (uint string). */
export function toRawAmount(amount: number, decimals: number): string {
  if (!isFinite(amount) || amount <= 0) return '0';
  const fixed = amount.toFixed(decimals);
  const raw = fixed.replace('.', '').replace(/^0+/, '');
  return raw.length > 0 ? raw : '0';
}

/** Стейблкоин по названию (USDC, USDT, USDC.e, …). */
const isStable = (symbol: string): boolean => symbol.toUpperCase().includes('USD');

interface ResolvedToken {
  symbol: string;
  address: string;
  decimals: number;
}

export interface BotTradeResult {
  trade: BotTrade;
  bot: Bot;
}

export interface ExecutorBalances {
  network: NetworkPrefix;
  executorAddress: string;
  balances: { symbol: string; address: string; decimals: number; balance: number }[];
}

/**
 * Ручная live-торговля бота (кнопки купить/продать на вкладке live).
 *
 * Демо-режим: котировка через квотер-контракт ArbQuoter (quoteExactIn по пулу
 * bidPool/askPool из market-data), проверка допустимого проскальзывания
 * (`bot.slippagePct`) против котировки из вебсокет-потока в момент клика; при
 * превышении сделка фейлится. Демосчёт обновляется только успешной сделкой.
 *
 * Реальный режим: своп on-chain через executor; сумма ограничена эквивалентом
 * 1 USDC (executor проверяем только на маленьких суммах), перед сделкой
 * проверяется баланс tokenIn на executor-контракте.
 *
 * Адреса и RPC квотера/экзекутора берутся из настроек пользователя (БД),
 * fallback — серверный .env. Токены пары резолвятся из пользовательского
 * сопоставления (сеть+адрес+название), fallback — встроенный каталог Arbitrum.
 */
@Injectable()
export class LiveTradingService {
  constructor(
    @InjectRepository(Bot)
    private readonly botsRepo: Repository<Bot>,
    @InjectRepository(BotTrade)
    private readonly tradesRepo: Repository<BotTrade>,
    private readonly marketConfigs: MarketConfigsService,
    private readonly marketData: MarketDataService,
    private readonly swapExecution: SwapExecutionService,
    private readonly quoter: SwapQuoterService,
    private readonly settings: TradingSettingsService,
  ) {}

  /**
   * Обнуляет демосчёт: баланс → начальный, позиция/PnL/счётчики — в ноль,
   * журнал демо-сделок очищается (реальные сделки остаются в истории).
   */
  async resetAccount(userId: string, botId: string): Promise<Bot> {
    const bot = await this.findBot(userId, botId);
    await this.tradesRepo.delete({ botId, mode: 'demo' });
    bot.balance = bot.initialBalance;
    bot.positionSize = 0;
    bot.entryPrice = 0;
    bot.openPosition = false;
    bot.pnl = 0;
    bot.pnlPct = 0;
    bot.tradesCount = 0;
    bot.winRate = 0;
    return this.botsRepo.save(bot);
  }

  /** Live-сделки бота (успешные и зафейленные) в хронологическом порядке;
   * опционально — только окно [from, to] (unix ms, например окно сессии). */
  async listTrades(
    userId: string,
    botId: string,
    opts: { from?: number; to?: number; limit?: number } = {},
  ): Promise<BotTrade[]> {
    await this.findBot(userId, botId);
    const where: Record<string, unknown> = { botId };
    if (opts.from != null || opts.to != null) {
      where.time = Between(opts.from ?? 0, opts.to ?? Number.MAX_SAFE_INTEGER);
    }
    const rows = await this.tradesRepo.find({
      where,
      order: { time: 'DESC' },
      take: opts.limit ?? 300,
    });
    return rows.reverse();
  }

  /**
   * Текущие балансы executor-контракта по токенам пары бота — фронт запрашивает
   * их при каждом заходе на живую торговлю в реальном режиме.
   */
  async executorBalances(userId: string, botId: string): Promise<ExecutorBalances> {
    const bot = await this.findBot(userId, botId);
    const { sourceId, pairId } = await this.resolveTradingMarket(userId, bot);
    const network = networkPrefixFromSource(sourceId);
    const executorCfg = await this.settings.findActiveContract(userId, 'executor', network);

    const executorAddress = this.resolveExecutorAddress(executorCfg, network);
    const rpcUrl = executorCfg?.rpcUrl || this.envNetwork(network).rpcUrl;
    if (!rpcUrl) {
      throw new BadRequestException(`Не задан RPC URL экзекутора (настройки или ${network}_RPC)`);
    }

    const [baseSym, quoteSym] = pairId.split('_');
    const tokens = await Promise.all([
      this.resolveToken(userId, network, baseSym),
      this.resolveToken(userId, network, quoteSym),
    ]);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balances = await Promise.all(
      tokens.map(async (t) => {
        const erc20 = new ethers.Contract(t.address, erc20Abi, provider);
        let raw = 0n;
        try {
          raw = await erc20.balanceOf(executorAddress);
        } catch {
          /* нечитаемый токен — покажем 0 */
        }
        return {
          symbol: t.symbol,
          address: t.address,
          decimals: t.decimals,
          balance: Number(ethers.formatUnits(raw, t.decimals)),
        };
      }),
    );

    return { network, executorAddress, balances };
  }

  async trade(
    userId: string,
    botId: string,
    dto: TradeRequestDto,
    extras: { stepResult?: Record<string, unknown> } = {},
  ): Promise<BotTradeResult> {
    const bot = await this.findBot(userId, botId);
    if (bot.mode === 'idle') {
      throw new BadRequestException('Бот выключен — включите демо или реальный режим в настройках.');
    }
    const isReal = bot.mode === 'real-live';
    const mode: BotTradeMode = isReal ? 'real' : 'demo';
    const side = dto.side;

    const { sourceId, pairId } = await this.resolveTradingMarket(userId, bot);
    if (!sourceId.startsWith('dex')) {
      throw new BadRequestException(
        'Торговля через квотер/экзекутор доступна только на DEX-рынке — выберите DEX торговым рынком конфигурации.',
      );
    }
    const network = networkPrefixFromSource(sourceId);
    const quoterCfg = await this.settings.findActiveContract(userId, 'quoter', network);
    const executorCfg = isReal
      ? await this.settings.findActiveContract(userId, 'executor', network)
      : null;

    // Направление задают валюты бота (валюту баланса выбирают в настройках):
    // buy = quoteAsset→baseAsset, sell = наоборот. Если валюты бота не
    // совпадают с токенами пары рынка (сменили конфигурацию) — листинг пары.
    const [listBase, listQuote] = pairId.split('_');
    const botMatchesPair =
      new Set([bot.baseAsset.toUpperCase(), bot.quoteAsset.toUpperCase()]).size === 2 &&
      [listBase.toUpperCase(), listQuote.toUpperCase()].every((s) =>
        [bot.baseAsset.toUpperCase(), bot.quoteAsset.toUpperCase()].includes(s),
      );
    const baseSym = botMatchesPair ? bot.baseAsset : listBase;
    const quoteSym = botMatchesPair ? bot.quoteAsset : listQuote;
    const tokenIn = await this.resolveToken(userId, network, side === 'buy' ? quoteSym : baseSym);
    const tokenOut = await this.resolveToken(userId, network, side === 'buy' ? baseSym : quoteSym);
    // Сторона пула привязана к листингу пары: покупка листингового base — ask,
    // продажа — bid. Если бот «перевёрнут» относительно листинга, стороны меняются.
    const buyingListBase = tokenOut.symbol.toUpperCase() === listBase.toUpperCase();
    const poolSide: 'ask' | 'bid' = buyingListBase ? 'ask' : 'bid';

    // Сумма входа: демо — покупка тратит quote-баланс, продажа — размер позиции;
    // реал — только маленькие суммы (эквивалент 1 USDC), считается ниже.
    let amountIn = dto.amount ?? (side === 'buy' ? bot.balance : bot.positionSize);
    if (!isReal && !(amountIn > 0)) {
      throw new BadRequestException(
        side === 'buy' ? 'Нет свободного баланса для покупки.' : 'Нет открытой позиции для продажи.',
      );
    }
    // Единая модель позиции для обоих режимов — иначе демо и реальную
    // торговлю нельзя сравнивать один к одному.
    if (side === 'buy' && bot.openPosition) {
      throw new BadRequestException('Позиция уже открыта — сначала продайте её.');
    }
    if (side === 'sell' && !bot.openPosition) {
      throw new BadRequestException('Нет открытой позиции — сначала купите.');
    }

    const slippagePct = bot.slippagePct ?? 0.5;
    const time = Date.now();

    let price: number | null = null;
    let rawPrice: number | null = null;
    let amountOut: number | null = null;
    let status: 'success' | 'failed' = 'failed';
    let error: string | null = null;
    let txHash = '';
    let txUrl = '';

    try {
      const pool = await this.marketData.getPool(sourceId, pairId, poolSide);

      let inHuman = amountIn;
      let outHuman: number;
      if (isReal) {
        // Executor проверяем только на маленьких суммах — эквивалент 1 USDC.
        // Продажа закрывает учётную позицию бота, если она меньше эквивалента.
        const equiv = await this.oneUsdcEquivalent(quoterCfg, network, pool, tokenIn, tokenOut);
        amountIn = side === 'sell' && bot.positionSize > 0 ? Math.min(equiv, bot.positionSize) : equiv;
        inHuman = amountIn;
        await this.assertExecutorBalance(executorCfg, network, tokenIn, amountIn);

        const payload = this.buildSwapPayload({
          network,
          pool,
          tokenIn,
          tokenOut,
          amountIn,
          slippagePct,
          execute: true,
        });
        const res = await this.swapExecution.execute(payload, {
          rpcUrl: executorCfg?.rpcUrl || undefined,
          executorAddress: executorCfg?.address || undefined,
        });
        const log = res.stepLogsNormalized[0];
        inHuman = Number(log.amountInDecimal);
        outHuman = Number(log.amountOutDecimal);
        txHash = res.transaction.hash;
        txUrl = res.transaction.url;
      } else {
        // Демо: котировка через квотер-контракт ArbQuoter — балансы не нужны,
        // транзакция не отправляется.
        const outRaw = await this.quoter.quoteExactIn({
          networkPrefix: network,
          pool,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountInRaw: BigInt(toRawAmount(amountIn, tokenIn.decimals)),
          rpcUrl: quoterCfg?.rpcUrl || undefined,
          quoterAddress: quoterCfg?.address || undefined,
        });
        outHuman = Number(ethers.formatUnits(outRaw, tokenOut.decimals));
      }

      if (!(inHuman > 0) || !(outHuman > 0)) {
        throw new BadRequestException('Квотер вернул нулевые объёмы — сделка невозможна.');
      }
      amountOut = outHuman;
      // Сырая цена листинга (quote за base) — для бухгалтерии демосчёта: PnL
      // всегда в quote-активе независимо от ориентации котировок потока.
      rawPrice = side === 'buy' ? inHuman / outHuman : outHuman / inHuman;
      let p = rawPrice;
      // Пары в market-data бывают перечислены «наоборот» (USDC_WBTC), а поток
      // котировок ориентирован по ролям токенов — тогда цена пула инверсна
      // котировке графика. Ориентации различаются на порядки, поэтому выбираем
      // ту, что ближе к цене, которую видел пользователь.
      if (dto.expectedPrice != null && dto.expectedPrice > 0 && p > 0) {
        const inv = 1 / p;
        if (
          Math.abs(Math.log(inv / dto.expectedPrice)) <
          Math.abs(Math.log(p / dto.expectedPrice))
        ) {
          p = inv;
        }
      }
      price = p;

      // Проверка проскальзывания в терминах выхода свопа: невыгодно = получаем
      // МЕНЬШЕ tokenOut, чем обещала котировка в момент клика (покрывает и уход
      // цены, и price impact крупного объёма — как on-chain amountOutMin).
      // Ориентация expectedPrice выбирается по близости к фактическому курсу.
      // В реальном режиме защита уже на цепочке (amountOutMin из slippageBps) —
      // раз транзакция прошла, лимит не был превышен.
      if (!isReal && dto.expectedPrice != null && dto.expectedPrice > 0) {
        const actualRate = outHuman / inHuman;
        const direct = dto.expectedPrice;
        const inverse = 1 / dto.expectedPrice;
        const expectedRate =
          Math.abs(Math.log(direct / actualRate)) <= Math.abs(Math.log(inverse / actualRate))
            ? direct
            : inverse;
        const movedPct = ((expectedRate - actualRate) / expectedRate) * 100;
        if (movedPct > slippagePct) {
          error =
            `Котировка ушла в невыгодную сторону на ${movedPct.toFixed(3)}% ` +
            `(допустимо ${slippagePct}%) — транзакция отклонена.`;
        }
      }
      if (!error) status = 'success';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    let pnl: number | null = null;
    // Учёт бота (баланс/позиция/PnL) ведётся в ОБОИХ режимах: цель live-режима —
    // сравнение демо и реальной торговли один к одному.
    if (status === 'success' && rawPrice != null && amountOut != null) {
      pnl = this.applyToAccount(bot, side, amountIn, amountOut, rawPrice);
    }

    const trade = this.tradesRepo.create({
      botId: bot.id,
      userId,
      time,
      side,
      status,
      mode,
      price,
      expectedPrice: dto.expectedPrice ?? null,
      amountIn,
      amountOut,
      pnl,
      error,
      txHash,
      txUrl,
      stepResult: extras.stepResult ?? null,
    });
    await this.tradesRepo.save(trade);

    if (status === 'success') {
      bot.tradesCount += 1;
      if (side === 'sell') bot.winRate = await this.recomputeWinRate(bot.id);
      await this.botsRepo.save(bot);
    }

    return { trade, bot };
  }

  /** Обновляет демосчёт бота успешной сделкой; возвращает PnL продажи. */
  private applyToAccount(
    bot: Bot,
    side: Side,
    amountIn: number,
    amountOut: number,
    price: number,
  ): number | null {
    if (side === 'buy') {
      bot.balance = Math.max(0, bot.balance - amountIn);
      bot.positionSize += amountOut;
      bot.entryPrice = price;
      bot.positionOpenedAt = Date.now();
      bot.openPosition = true;
      return null;
    }
    const pnl = (price - bot.entryPrice) * amountIn;
    bot.balance += amountOut;
    bot.positionSize = Math.max(0, bot.positionSize - amountIn);
    bot.openPosition = bot.positionSize > 1e-12;
    if (!bot.openPosition) {
      bot.entryPrice = 0;
      bot.positionSize = 0;
      bot.positionOpenedAt = 0;
    }
    bot.pnl += pnl;
    bot.pnlPct = bot.initialBalance > 0 ? (bot.pnl / bot.initialBalance) * 100 : 0;
    return pnl;
  }

  /** Winrate по закрывающим (sell) успешным сделкам из журнала. */
  private async recomputeWinRate(botId: string): Promise<number> {
    const sells = await this.tradesRepo.find({
      where: { botId, side: 'sell', status: 'success' },
    });
    if (sells.length === 0) return 0;
    const wins = sells.filter((t) => (t.pnl ?? 0) > 0).length;
    return +((wins / sells.length) * 100).toFixed(1);
  }

  /**
   * Сумма tokenIn, эквивалентная 1 USDC: стейбл → 1; иначе курс к стейблу
   * берём у квотера (1 tokenIn → сколько tokenOut). Пары без стейбла для
   * реальной торговли не поддерживаются — нечем оценить $-эквивалент.
   */
  private async oneUsdcEquivalent(
    quoterCfg: UserTradingContract | null,
    network: NetworkPrefix,
    pool: PoolInfo,
    tokenIn: ResolvedToken,
    tokenOut: ResolvedToken,
  ): Promise<number> {
    if (isStable(tokenIn.symbol)) return 1;
    if (!isStable(tokenOut.symbol)) {
      throw new BadRequestException(
        'Реальная сделка ограничена эквивалентом 1 USDC — нужна пара со стейблкоином, чтобы оценить эквивалент.',
      );
    }
    // Проба — 0.0001 tokenIn: целый токен на неликвидном пуле даёт price
    // impact и искажает курс, микропроба меряет цену у поверхности.
    const probeRaw = (() => {
      const raw = 10n ** BigInt(tokenIn.decimals) / 10_000n;
      return raw > 0n ? raw : 1n;
    })();
    const probeHuman = Number(ethers.formatUnits(probeRaw, tokenIn.decimals));
    const outRaw = await this.quoter.quoteExactIn({
      networkPrefix: network,
      pool,
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountInRaw: probeRaw,
      rpcUrl: quoterCfg?.rpcUrl || undefined,
      quoterAddress: quoterCfg?.address || undefined,
    });
    const outHuman = Number(ethers.formatUnits(outRaw, tokenOut.decimals));
    const rate = probeHuman > 0 ? outHuman / probeHuman : 0; // стейблов за 1 tokenIn
    if (!(rate > 0)) {
      throw new BadRequestException('Не удалось оценить эквивалент 1 USDC — квотер вернул нулевой курс.');
    }
    return 1 / rate;
  }

  /** Реальная сделка тратит токены executor — убеждаемся, что они там есть. */
  private async assertExecutorBalance(
    executorCfg: UserTradingContract | null,
    network: NetworkPrefix,
    tokenIn: ResolvedToken,
    amountIn: number,
  ): Promise<void> {
    const executorAddress = this.resolveExecutorAddress(executorCfg, network);
    const rpcUrl = executorCfg?.rpcUrl || this.envNetwork(network).rpcUrl;
    if (!rpcUrl) {
      throw new BadRequestException(`Не задан RPC URL экзекутора (настройки или ${network}_RPC)`);
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const erc20 = new ethers.Contract(tokenIn.address, erc20Abi, provider);
    const raw: bigint = await erc20.balanceOf(executorAddress);
    const need = BigInt(toRawAmount(amountIn, tokenIn.decimals));
    if (raw < need) {
      const have = Number(ethers.formatUnits(raw, tokenIn.decimals));
      throw new BadRequestException(
        `На executor-контракте недостаточно ${tokenIn.symbol}: есть ${have}, нужно ${amountIn}. Пополните контракт ${executorAddress}.`,
      );
    }
  }

  private resolveExecutorAddress(executorCfg: UserTradingContract | null, network: NetworkPrefix): string {
    const address = executorCfg?.address || this.envNetwork(network).executorAddress;
    if (!ethers.isAddress(address)) {
      throw new BadRequestException(
        `Не задан адрес executor-контракта — укажите его в настройках или ${network}_EXECUTOR_ADDRESS в .env`,
      );
    }
    return address;
  }

  private envNetwork(network: NetworkPrefix): { rpcUrl: string; executorAddress: string } {
    return {
      rpcUrl: this.swapExecution.envRpcUrl(network),
      executorAddress: this.swapExecution.envExecutorAddress(network),
    };
  }

  /**
   * Токен по названию: пользовательское сопоставление (сеть+адрес+название) из
   * настроек, fallback — встроенный каталог Arbitrum-токенов.
   */
  private async resolveToken(
    userId: string,
    network: NetworkPrefix,
    symbol: string,
  ): Promise<ResolvedToken> {
    const userToken = await this.settings.findTokenBySymbol(userId, network, symbol);
    if (userToken) {
      return { symbol: userToken.symbol, address: userToken.address, decimals: userToken.decimals };
    }
    if (network === NetworkPrefix.ARBITRUM) {
      const builtin = getTokenMeta(symbol);
      if (builtin) return { symbol, address: builtin.address, decimals: builtin.decimals };
    }
    throw new BadRequestException(
      `Токен «${symbol}» (сеть ${network}) не найден — добавьте его в настройках (сопоставление токенов).`,
    );
  }

  /**
   * Payload для SwapExecutionService (зеркало `buildExecuteSwapPayload` из
   * Angular-фронта). profitToken ОБЯЗАН быть tokenOut: ArbExecutor меряет
   * убыток по балансу profitToken, и при одношаговом свопе A→B выбор A
   * приводит к ложному LOSS_EXCEEDS_LIMIT.
   */
  private buildSwapPayload(input: {
    network: NetworkPrefix;
    pool: PoolInfo;
    tokenIn: ResolvedToken;
    tokenOut: ResolvedToken;
    amountIn: number;
    slippagePct: number;
    execute: boolean;
  }): ExecuteSwapDto {
    const kind = poolKind(input.pool);
    // v2-style (router-based): в poolAddress лежит роутер, путь [in, out].
    // v3-style (pool-direct): в poolAddress лежит сам пул.
    const isV2Kind = kind === 0 || kind === 2;

    const step: SwapStepDto = {
      kind,
      router: isV2Kind ? input.pool.poolAddress : ZERO_ADDRESS,
      path: isV2Kind ? [input.tokenIn.address, input.tokenOut.address] : [],
      pool: isV2Kind ? ZERO_ADDRESS : input.pool.poolAddress,
      tokenIn: input.tokenIn.address,
      tokenOut: input.tokenOut.address,
      amountIn: toRawAmount(input.amountIn, input.tokenIn.decimals),
      // Минимум считает бэкенд из реального preview-выхода пула и slippageBps.
      amountOutMin: '0',
      sqrtPriceLimitX96: '0',
      deadline: '0',
    };

    return {
      networkPrefix: input.network,
      steps: [step],
      profitToken: input.tokenOut.address,
      slippageBps: Math.max(1, Math.round(input.slippagePct * 100)),
      execute: input.execute,
      revertIfLoss: false,
      emitEvents: true,
      tokenDecimalsByAddress: {
        [input.tokenIn.address]: input.tokenIn.decimals,
        [input.tokenOut.address]: input.tokenOut.decimals,
      },
    };
  }

  /** Торговый рынок бота → sourceId + pairId (формат id: `${sourceId}__${pairId}`). */
  private async resolveTradingMarket(
    userId: string,
    bot: Bot,
  ): Promise<{ sourceId: string; pairId: string }> {
    const mc = await this.marketConfigs.findOne(userId, bot.marketConfigId);
    const marketId = mc.tradingMarketId ?? mc.observedMarketIds[0];
    if (!marketId) {
      throw new BadRequestException('У конфигурации рынков бота не задан торговый рынок.');
    }
    const idx = marketId.indexOf('__');
    if (idx > 0) {
      return { sourceId: marketId.slice(0, idx), pairId: marketId.slice(idx + 2) };
    }
    const market = findMarket(marketId);
    if (!market) {
      throw new BadRequestException(`Не удалось разобрать торговый рынок «${marketId}».`);
    }
    return { sourceId: market.sourceId, pairId: market.pairId };
  }

  private async findBot(userId: string, id: string): Promise<Bot> {
    const bot = await this.botsRepo.findOne({ where: { id, userId } });
    if (!bot) throw new NotFoundException('Бот не найден');
    return bot;
  }
}
