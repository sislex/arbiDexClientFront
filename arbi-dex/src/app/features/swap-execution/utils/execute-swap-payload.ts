import { SwapDirection } from '../../../shared/models';
import { getTokenMeta } from '../../../shared/constants';
import { PoolInfo } from '../services/market-data.service';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Шаг свопа для ExecuteSwapDto (бэкенд `SwapStepDto`) */
export interface SwapStepPayload {
  kind: number;
  router: string;
  path: string[];
  pool: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOutMin: string;
  sqrtPriceLimitX96: string;
  deadline: string;
}

/** Тело запроса для `POST /api/swap-execution/execute` (бэкенд `ExecuteSwapDto`) */
export interface ExecuteSwapPayload {
  networkPrefix: string;
  steps: SwapStepPayload[];
  profitToken: string;
  slippageBps: number;
  execute: boolean;
  revertIfLoss: boolean;
  emitEvents: boolean;
  tokenDecimalsByAddress: Record<string, number>;
}

export interface BuildPayloadInput {
  direction: SwapDirection;
  /** Сумма входа в человекочитаемых единицах токена */
  amountIn: number;
  /** Ожидаемый выход (tokenOut) по текущей котировке с учётом slippage — идёт в amountOutMin */
  expectedOut: number;
  /** sourceId торговой подписки, напр. `dex:arbitrum` */
  sourceId: string;
  /** pairId торговой подписки, напр. `WETH_USDC` */
  pairId: string;
  /** Актив профита (символ), напр. `USDC` */
  profitAsset: string;
  /** Проскальзывание как доля (0.01 = 1%) */
  slippage: number;
  /** Метаданные пула (bidPool для продажи base, askPool для покупки base) */
  pool: PoolInfo;
  /** Выполнить on-chain своп (`true`) или только preview (`false`, по умолчанию) */
  execute?: boolean;
}

/** Маппинг `dex:<network>` → NetworkPrefix бэкенда */
function networkPrefixFromSource(sourceId: string): string {
  const network = sourceId.includes(':') ? sourceId.split(':')[1] : sourceId;
  return network.toUpperCase();
}

/**
 * Определяет `kind` (enum SwapKind контракта ArbExecutor) по dex/version пула.
 * v2=0, uniV3=1, camelotV2=2, algebra/camelotV3=3, v4=4.
 *
 * Особенность маркет-дата системы: для v2-пулов в `poolAddress` хранится
 * **адрес роутера**, а не самого пула. Для camelot `poolAddress` всегда содержит
 * Camelot V2 Router → всегда используем kind=2 (роутер-based своп).
 */
export function poolKind(pool: PoolInfo): number {
  const dex = (pool.dex ?? '').toLowerCase();
  const version = (pool.version ?? '').toLowerCase();

  if (dex.includes('camelot')) return 2;

  if (version === 'v4') return 4;
  if (version === 'v3') return 1;
  if (version === 'v2') return 0;
  return 1;
}

/** Преобразует человекочитаемую сумму в raw-единицы токена (uint string). */
export function toRawAmount(amount: number, decimals: number): string {
  if (!isFinite(amount) || amount <= 0) return '0';
  const fixed = amount.toFixed(decimals);
  const raw = fixed.replace('.', '').replace(/^0+/, '');
  return raw.length > 0 ? raw : '0';
}

/**
 * Готовит payload для execute-API на основе параметров сделки и метаданных пула.
 * Ничего не отправляет — только формирует объект.
 *
 * Направление трактуется относительно base токена пары:
 *   USDC_TO_WETH — покупка base (quote→base), сторона ask.
 *   WETH_TO_USDC — продажа base (base→quote), сторона bid.
 */
export function buildExecuteSwapPayload(input: BuildPayloadInput): ExecuteSwapPayload {
  const { direction, amountIn, expectedOut, sourceId, pairId, profitAsset, slippage, pool } = input;

  const [baseSym, quoteSym] = pairId.split('_');
  const baseMeta = getTokenMeta(baseSym);
  const quoteMeta = getTokenMeta(quoteSym);
  if (!baseMeta || !quoteMeta) {
    throw new Error(`Неизвестные токены пары: ${pairId}`);
  }

  const buyingBase = direction === 'USDC_TO_WETH';
  const tokenInMeta = buyingBase ? quoteMeta : baseMeta;
  const tokenOutMeta = buyingBase ? baseMeta : quoteMeta;

  const profitMeta = getTokenMeta(profitAsset) ?? quoteMeta;

  const kind = poolKind(pool);
  // v2-style (router-based): poolAddress содержит адрес роутера, путь — [tokenIn, tokenOut].
  // v3-style (pool-direct): poolAddress содержит адрес пула, роутер не нужен.
  const isV2Kind = kind === 0 || kind === 2;

  const step: SwapStepPayload = {
    kind,
    router: isV2Kind ? pool.poolAddress : ZERO_ADDRESS,
    path: isV2Kind ? [tokenInMeta.address, tokenOutMeta.address] : [],
    pool: isV2Kind ? ZERO_ADDRESS : pool.poolAddress,
    tokenIn: tokenInMeta.address,
    tokenOut: tokenOutMeta.address,
    amountIn: toRawAmount(amountIn, tokenInMeta.decimals),
    amountOutMin: '0',
    sqrtPriceLimitX96: '0',
    deadline: '0',
  };

  return {
    networkPrefix: networkPrefixFromSource(sourceId),
    steps: [step],
    profitToken: profitMeta.address,
    slippageBps: 1,
    execute: input.execute ?? false,
    revertIfLoss: false,
    emitEvents: true,
    tokenDecimalsByAddress: {
      [tokenInMeta.address]: tokenInMeta.decimals,
      [tokenOutMeta.address]: tokenOutMeta.decimals,
    },
  };
}
