import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { NetworkPrefix } from './dto/execute-swap.dto';

/** Метаданные пула из arbiDexMarketData (см. MarketDataService.getPool). */
export interface QuotedPool {
  dex: string;
  version: string;
  poolAddress: string;
}

export interface QuoteExactInInput {
  networkPrefix: NetworkPrefix;
  pool: QuotedPool;
  tokenIn: string;
  tokenOut: string;
  /** Сумма входа в raw-единицах tokenIn. */
  amountInRaw: bigint;
  /** RPC URL квотера (настройки пользователя); пусто → <PREFIX>_RPC из .env. */
  rpcUrl?: string;
  /** Адрес ArbQuoter (настройки пользователя); пусто → <PREFIX>_QUOTER_ADDRESS. */
  quoterAddress?: string;
}

/** enum SwapKind контракта: V2=0, V3_POOL=1, CAMELOT_V2=2, ALGEBRA_POOL=3, V4_POOL=4. */
export function poolKindOf(pool: QuotedPool): number {
  const dex = (pool.dex ?? '').toLowerCase();
  const version = (pool.version ?? '').toLowerCase();
  const isCamelot = dex.includes('camelot');
  if (version === 'v2') return isCamelot ? 2 : 0;
  if (version === 'v3') return isCamelot ? 3 : 1;
  if (version === 'v4') return 4;
  return 1;
}

const arbQuoterAbi = [
  'function quoteExactIn((uint8 kind,address router,address[] path,address pool,address tokenIn,address tokenOut,uint24 v4Fee,int24 v4TickSpacing,address v4Hooks) step, uint256 amountIn) returns (uint256 amountOut, bool success)',
] as const;

/**
 * Квотер: котировка свопа через задеплоенный контракт ArbQuoter
 * (`arbiDexSmartcontracts/contracts/ArbQuoter.sol`) — quoteExactIn по одному
 * пулу (bidPool/askPool из market-data). Контракт сам решает как котировать по
 * kind: V2/CamelotV2 → router.getAmountsOut, V3/Algebra → симуляция pool.swap
 * с callback-revert, V4 → внешний Uniswap V4 Quoter. Балансы не нужны,
 * транзакция не отправляется (staticCall).
 *
 * RPC URL и адрес контракта берутся из настроек пользователя (БД), fallback —
 * серверный .env (<PREFIX>_RPC / <PREFIX>_QUOTER_ADDRESS).
 */
@Injectable()
export class SwapQuoterService {
  private readonly logger = new Logger(SwapQuoterService.name);

  constructor(private readonly configService: ConfigService) {}

  /** Котировка exact-in: сколько tokenOut даст пул за `amountInRaw` tokenIn. */
  async quoteExactIn(input: QuoteExactInInput): Promise<bigint> {
    const basePath = `swapNetworks.networks.${input.networkPrefix}`;
    const rpcUrl = input.rpcUrl || (this.configService.get<string>(`${basePath}.rpcUrl`) ?? '');
    if (!rpcUrl) {
      throw new BadRequestException(
        `Не задан RPC URL квотера — укажите его в настройках или ${input.networkPrefix}_RPC в .env`,
      );
    }
    const quoterAddress =
      input.quoterAddress || (this.configService.get<string>(`${basePath}.quoterAddress`) ?? '');
    if (!ethers.isAddress(quoterAddress)) {
      throw new BadRequestException(
        `Не задан адрес квотер-контракта — укажите его в настройках или ${input.networkPrefix}_QUOTER_ADDRESS в .env`,
      );
    }

    const kind = poolKindOf(input.pool);
    // Router-based (kind 0/2): в poolAddress лежит роутер; pool-direct (1/3/4) — сам пул.
    const isRouterKind = kind === 0 || kind === 2;
    const step = {
      kind,
      router: isRouterKind ? input.pool.poolAddress : ethers.ZeroAddress,
      path: [] as string[], // контракт сам построит [tokenIn, tokenOut] при пустом path
      pool: isRouterKind ? ethers.ZeroAddress : input.pool.poolAddress,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      v4Fee: 0,
      v4TickSpacing: 0,
      v4Hooks: ethers.ZeroAddress,
    };

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const quoter = new ethers.Contract(quoterAddress, arbQuoterAbi, provider);

    let amountOut: bigint;
    let success: boolean;
    try {
      const res = await quoter.quoteExactIn.staticCall(step, input.amountInRaw);
      amountOut = res[0] as bigint;
      success = res[1] as boolean;
    } catch (error) {
      this.logger.error(
        `ArbQuoter.quoteExactIn упал (${quoterAddress}, pool ${input.pool.poolAddress}): ${(error as Error).message}`,
      );
      throw new BadRequestException('Квотер не смог получить цену пула — попробуйте ещё раз.');
    }

    if (!success || amountOut <= 0n) {
      throw new BadRequestException(
        `Квотер не смог прокотировать пул ${input.pool.dex} ${input.pool.version} (${input.pool.poolAddress}).`,
      );
    }
    return amountOut;
  }
}
