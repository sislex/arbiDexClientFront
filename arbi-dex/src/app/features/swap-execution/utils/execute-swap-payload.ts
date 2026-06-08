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
 * Определяет `kind` по enum SwapKind контракта ArbExecutor:
 *   V2_EXACT_IN=0, V3_POOL_EXACT_IN=1, CAMELOT_V2_EXACT_IN=2,
 *   ALGEBRA_POOL_EXACT_IN=3, V4_POOL_EXACT_IN=4.
 *
 * Внимание: camelot бывает двух версий — V2 (router-based, kind=2) и
 * V3/Algebra (pool-direct, kind=3). Различаем по version, НЕ по одному dex,
 * иначе camelot v3 ошибочно уходит как kind=2 и валидатор бэкенда требует
 * Camelot V2 Router там, где лежит адрес Algebra-пула.
 *
 * Router-based (kind 0/2): в `poolAddress` лежит адрес роутера.
 * Pool-direct (kind 1/3/4): в `poolAddress` лежит адрес самого пула.
 */
export function poolKind(pool: PoolInfo): number {
  const dex = (pool.dex ?? '').toLowerCase();
  const version = (pool.version ?? '').toLowerCase();
  const isCamelot = dex.includes('camelot');

  if (version === 'v2') return isCamelot ? 2 : 0;
  if (version === 'v3') return isCamelot ? 3 : 1; // camelot v3 = Algebra → 3
  if (version === 'v4') return 4;
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
 * Направление задаёт токены напрямую (`USDC_TO_WETH` → in=USDC, out=WETH).
 * НЕ опираемся на порядок base/quote в pairId: он может быть как `WETH_USDC`,
 * так и `USDC_WETH`, и привязка in/out к base инвертирует своп.
 */
export function buildExecuteSwapPayload(input: BuildPayloadInput): ExecuteSwapPayload {
  const { direction, amountIn, sourceId, slippage, pool } = input;

  const [tokenInSym, tokenOutSym] = direction.split('_TO_');
  const tokenInMeta = getTokenMeta(tokenInSym);
  const tokenOutMeta = getTokenMeta(tokenOutSym);
  if (!tokenInMeta || !tokenOutMeta) {
    throw new Error(`Неизвестные токены направления: ${direction}`);
  }

  // profitToken ОБЯЗАН быть выходным токеном свопа (tokenOut).
  // ArbExecutor меряет убыток по балансу profitToken: при одношаговом свопе
  // A→B баланс A падает, поэтому если profitToken=A (потраченный токен),
  // контракт видит «убыток» и реверзит LOSS_EXCEEDS_LIMIT. Меряя по tokenOut,
  // получаем прирост баланса → profit>0 → проверка убытка не срабатывает.
  // (Подтверждено fork-тестом ArbExecutor.quoterVsExecutor: profitToken=tokenOut.)
  const profitMeta = tokenOutMeta;

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
    // amountOutMin всегда 0 — минимум считает бэкенд из реального preview-выхода
    // пула и slippageBps. Клиентская оценка (expectedOut) основана на котировке
    // reference-источника и НЕ совпадает с ценой пула исполнения (Camelot/UniV3),
    // поэтому как on-chain минимум она давала CamelotRouter: INSUFFICIENT_OUTPUT_AMOUNT.
    // Защита от проскальзывания сохраняется через slippageBps (от реальной цены пула).
    amountOutMin: '0',
    sqrtPriceLimitX96: '0',
    deadline: '0',
  };

  return {
    networkPrefix: networkPrefixFromSource(sourceId),
    steps: [step],
    profitToken: profitMeta.address,
    slippageBps: Math.max(1, Math.round(slippage * 10000)),
    execute: input.execute ?? false,
    revertIfLoss: false,
    emitEvents: true,
    tokenDecimalsByAddress: {
      [tokenInMeta.address]: tokenInMeta.decimals,
      [tokenOutMeta.address]: tokenOutMeta.decimals,
    },
  };
}
