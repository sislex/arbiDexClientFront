import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { ExecuteSwapDto, NetworkPrefix, SwapStepDto } from './dto/execute-swap.dto';

interface ArbExecutorStep {
  kind: number;
  router: string;
  path: string[];
  pool: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOutMin: bigint;
  sqrtPriceLimitX96: bigint;
  deadline: bigint;
}

interface ContractSummary {
  blockNumber: bigint;
  blockTimestamp: bigint;
  profitToken: string;
  startBalance: bigint;
  endBalance: bigint;
  profit: bigint;
  totalGasUsed: bigint;
  stepsCount: bigint;
}

interface ContractStepLog {
  index: bigint;
  kind: bigint;
  target: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  gasUsed: bigint;
}

interface SwapNetworkConfig {
  rpcUrl: string;
  executorAddress: string;
  txUrl: string;
  routers: {
    uniswapV2: string;
    sushiV2: string;
    camelotV2: string;
  };
}

const KIND_V2_EXACT_IN = 0;
const KIND_V3_POOL_EXACT_IN = 1;
const KIND_CAMELOT_V2_EXACT_IN = 2;
const KIND_ALGEBRA_POOL_EXACT_IN = 3;
const KIND_V4_POOL_EXACT_IN = 4;

const arbExecutorAbi = [
  'function owner() view returns (address)',
  'function executeSwaps((uint8 kind,address router,address[] path,address pool,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOutMin,uint160 sqrtPriceLimitX96,uint256 deadline)[] steps,address profitToken,bool revertIfLoss,bool emitEvents) returns ((uint256 blockNumber,uint256 blockTimestamp,address profitToken,uint256 startBalance,uint256 endBalance,int256 profit,uint256 totalGasUsed,uint256 stepsCount) summary,(uint256 index,uint8 kind,address target,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint256 gasUsed)[] logs)',
] as const;

const erc20Abi = ['function decimals() view returns (uint8)'] as const;

export function computeAmountOutMin(previewAmountOut: bigint, slippageBps: number): bigint {
  return (previewAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function buildTxUrl(baseTxUrl: string, txHash: string): string {
  const trimmed = baseTxUrl.trim();
  if (!trimmed) return '';

  if (trimmed.includes('{hash}')) {
    return trimmed.replace('{hash}', txHash);
  }

  return trimmed.endsWith('/') ? `${trimmed}${txHash}` : `${trimmed}/${txHash}`;
}

export function getRouterValidationError(
  kind: number,
  router: string,
  routers: { uniswapV2: string; sushiV2: string; camelotV2: string },
): string | null {
  const normalizedRouter = router.toLowerCase();
  const zeroAddress = ethers.ZeroAddress.toLowerCase();

  if (
    kind === KIND_V3_POOL_EXACT_IN ||
    kind === KIND_ALGEBRA_POOL_EXACT_IN ||
    kind === KIND_V4_POOL_EXACT_IN
  ) {
    if (normalizedRouter !== zeroAddress) {
      return `Для kind=${kind} router должен быть ${ethers.ZeroAddress}`;
    }
    return null;
  }

  if (kind === KIND_V2_EXACT_IN) {
    const allowedRouters = [routers.uniswapV2, routers.sushiV2]
      .filter((v) => ethers.isAddress(v))
      .map((v) => v.toLowerCase());

    if (allowedRouters.length === 0) {
      return 'В конфиге сети не заданы V2 роутеры (_UNISWAP_V2_ROUTER / _SUSHI_V2_ROUTER)';
    }
    if (!allowedRouters.includes(normalizedRouter)) {
      return `Router ${router} не разрешён для kind=0. Ожидается один из V2 роутеров сети`;
    }
    return null;
  }

  if (kind === KIND_CAMELOT_V2_EXACT_IN) {
    if (!ethers.isAddress(routers.camelotV2)) {
      return 'В конфиге сети не задан _CAMELOT_V2_ROUTER для kind=2';
    }
    if (normalizedRouter !== routers.camelotV2.toLowerCase()) {
      return `Router ${router} не совпадает с _CAMELOT_V2_ROUTER для kind=2`;
    }
  }

  return null;
}

@Injectable()
export class SwapExecutionService {
  private readonly logger = new Logger(SwapExecutionService.name);

  constructor(private readonly configService: ConfigService) {}

  /** Серверный .env RPC сети (fallback, когда настройки пользователя пусты). */
  envRpcUrl(prefix: NetworkPrefix): string {
    return this.configService.get<string>(`swapNetworks.networks.${prefix}.rpcUrl`) ?? '';
  }

  /** Серверный .env адрес executor-контракта сети (fallback). */
  envExecutorAddress(prefix: NetworkPrefix): string {
    return this.configService.get<string>(`swapNetworks.networks.${prefix}.executorAddress`) ?? '';
  }

  async execute(
    dto: ExecuteSwapDto,
    overrides?: { rpcUrl?: string; executorAddress?: string },
  ) {
    const shouldExecute = dto.execute ?? true;
    const privateKey = this.configService.get<string>('swapNetworks.privateKey') ?? '';
    // Ключ обязателен только для on-chain исполнения. Preview (квотер) работает
    // и без него: executeSwaps.staticCall симулируется от имени owner контракта
    // через overrides `{ from: owner }` — eth_call это позволяет.
    if (!privateKey && shouldExecute) {
      throw new BadRequestException('Не задан PRIVATE_KEY в конфигурации сервера');
    }

    const networkCfg = this.getNetworkConfig(dto.networkPrefix);
    // Настройки пользователя (БД) приоритетнее серверного .env.
    if (overrides?.rpcUrl) networkCfg.rpcUrl = overrides.rpcUrl;
    if (overrides?.executorAddress) {
      if (!ethers.isAddress(overrides.executorAddress)) {
        throw new BadRequestException('Некорректный адрес executor-контракта в настройках');
      }
      networkCfg.executorAddress = overrides.executorAddress;
    }
    if (!networkCfg.rpcUrl) {
      throw new BadRequestException(`Не задан ${dto.networkPrefix}_RPC (и нет RPC в настройках)`);
    }
    if (!ethers.isAddress(networkCfg.executorAddress)) {
      throw new BadRequestException(
        `Не задан адрес executor-контракта — укажите его в настройках или ${dto.networkPrefix}_EXECUTOR_ADDRESS в .env`,
      );
    }

    const provider = new ethers.JsonRpcProvider(networkCfg.rpcUrl);
    const wallet = privateKey ? new ethers.Wallet(privateKey, provider) : null;
    const executor = new ethers.Contract(
      networkCfg.executorAddress,
      arbExecutorAbi,
      wallet ?? provider,
    );

    const owner = await executor.owner();
    if (wallet && owner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new BadRequestException(
        `Кошелёк ${wallet.address} не является owner executor-контракта ${owner}`,
      );
    }

    const slippageBps = dto.slippageBps ?? 50;
    const revertIfLoss = dto.revertIfLoss ?? false;
    const emitEvents = dto.emitEvents ?? true;

    dto.steps.forEach((step, idx) => {
      const validationError = getRouterValidationError(step.kind, step.router, networkCfg.routers);
      if (validationError) {
        throw new BadRequestException(`Ошибка в step #${idx + 1}: ${validationError}`);
      }
    });

    const previewSteps = dto.steps.map((step) => this.toContractStep(step, 0n));

    let previewSummary: ContractSummary;
    let previewLogs: ContractStepLog[];
    try {
      const preview = await executor.executeSwaps.staticCall(
        previewSteps,
        dto.profitToken,
        revertIfLoss,
        false,
        // Без кошелька симулируем вызов от owner — executeSwaps onlyOwner.
        ...(wallet ? [] : [{ from: owner }]),
      );
      previewSummary = preview[0] as ContractSummary;
      previewLogs = preview[1] as ContractStepLog[];
    } catch (error) {
      this.logger.error(`Preview executeSwaps failed: ${error.message}`);
      throw new BadRequestException('Не удалось выполнить preview executeSwaps');
    }

    if (previewLogs.length !== dto.steps.length) {
      throw new InternalServerErrorException(
        `Ожидалось ${dto.steps.length} preview-логов, получено ${previewLogs.length}`,
      );
    }

    const clientDecimalsMap = this.normalizeClientDecimals(dto.tokenDecimalsByAddress);
    const resolvedStepsMeta = dto.steps.map((step, idx) => {
      const previewOut = previewLogs[idx].amountOut;
      const computedAmountOutMin = computeAmountOutMin(previewOut, slippageBps);
      const clientAmountOutMin = BigInt(step.amountOutMin ?? '0');
      const useClient = clientAmountOutMin > 0n;
      const appliedAmountOutMin = useClient ? clientAmountOutMin : computedAmountOutMin;

      return {
        clientAmountOutMin,
        computedAmountOutMin,
        appliedAmountOutMin,
        amountOutMinSource: useClient ? 'client' : 'computed',
      };
    });

    const executionSteps = dto.steps.map((step, idx) =>
      this.toContractStep(step, resolvedStepsMeta[idx].appliedAmountOutMin),
    );

    const previewTotals = resolvedStepsMeta.reduce(
      (acc, meta, idx) => {
        acc.amountIn += previewLogs[idx].amountIn;
        acc.amountOut += previewLogs[idx].amountOut;
        acc.clientAmountOutMin += meta.clientAmountOutMin;
        acc.computedAmountOutMin += meta.computedAmountOutMin;
        acc.appliedAmountOutMin += meta.appliedAmountOutMin;
        return acc;
      },
      {
        amountIn: 0n,
        amountOut: 0n,
        clientAmountOutMin: 0n,
        computedAmountOutMin: 0n,
        appliedAmountOutMin: 0n,
      },
    );

    let txHash = '';
    let txUrl = '';
    let gasUsed = 0n;
    let gasPriceWei = 0n;
    let gasSpentWei = 0n;
    let blockNumber = 0;
    let blockTimestampMs = Number(previewSummary.blockTimestamp) * 1000;
    const requestedAtMs = Date.now();
    let minedAtMs = requestedAtMs;
    let latencyMs = 0;

    if (shouldExecute) {
      const tx = await executor.executeSwaps(
        executionSteps,
        dto.profitToken,
        revertIfLoss,
        emitEvents,
      );
      txHash = tx.hash;
      txUrl = buildTxUrl(networkCfg.txUrl, txHash);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new InternalServerErrorException('Не удалось получить receipt транзакции');
      }

      blockNumber = receipt.blockNumber;
      gasUsed = receipt.gasUsed ?? 0n;
      gasPriceWei = receipt.gasPrice ?? 0n;
      gasSpentWei = gasUsed * gasPriceWei;

      const minedBlock = await provider.getBlock(receipt.blockNumber);
      if (minedBlock?.timestamp) {
        blockTimestampMs = minedBlock.timestamp * 1000;
      }

      minedAtMs = Date.now();
      latencyMs = Math.max(0, minedAtMs - requestedAtMs);
    }

    const decimalsCache = new Map<string, number>();
    const resolveDecimals = async (tokenAddress: string): Promise<number> => {
      const normalized = tokenAddress.toLowerCase();
      if (clientDecimalsMap.has(normalized)) {
        return clientDecimalsMap.get(normalized)!;
      }
      if (decimalsCache.has(normalized)) {
        return decimalsCache.get(normalized)!;
      }

      try {
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
        const decimals = Number(await tokenContract.decimals());
        decimalsCache.set(normalized, decimals);
        return decimals;
      } catch {
        decimalsCache.set(normalized, 18);
        return 18;
      }
    };

    const stepLogsRaw = previewLogs.map((log) => ({
      index: Number(log.index),
      kind: Number(log.kind),
      target: log.target,
      tokenIn: log.tokenIn,
      tokenOut: log.tokenOut,
      amountIn: log.amountIn.toString(),
      amountOut: log.amountOut.toString(),
      gasUsed: log.gasUsed.toString(),
    }));

    const stepLogsNormalized = await Promise.all(
      previewLogs.map(async (log, idx) => {
        const tokenInDecimals = await resolveDecimals(log.tokenIn);
        const tokenOutDecimals = await resolveDecimals(log.tokenOut);
        const meta = resolvedStepsMeta[idx];

        return {
          index: Number(log.index),
          kind: Number(log.kind),
          target: log.target,
          tokenIn: log.tokenIn,
          tokenOut: log.tokenOut,
          tokenInDecimals,
          tokenOutDecimals,
          amountInRaw: log.amountIn.toString(),
          amountOutRaw: log.amountOut.toString(),
          gasUsedRaw: log.gasUsed.toString(),
          amountInDecimal: ethers.formatUnits(log.amountIn, tokenInDecimals),
          amountOutDecimal: ethers.formatUnits(log.amountOut, tokenOutDecimals),
          requestedAmountOutMinRaw: meta.clientAmountOutMin.toString(),
          appliedAmountOutMinRaw: meta.appliedAmountOutMin.toString(),
          computedAmountOutMinRaw: meta.computedAmountOutMin.toString(),
          requestedAmountOutMinDecimal: ethers.formatUnits(meta.clientAmountOutMin, tokenOutDecimals),
          appliedAmountOutMinDecimal: ethers.formatUnits(meta.appliedAmountOutMin, tokenOutDecimals),
          computedAmountOutMinDecimal: ethers.formatUnits(meta.computedAmountOutMin, tokenOutDecimals),
          amountOutMinSource: meta.amountOutMinSource,
        };
      }),
    );

    return {
      networkPrefix: dto.networkPrefix,
      execute: shouldExecute,
      transaction: {
        hash: txHash,
        url: txUrl,
        requestedAt: new Date(requestedAtMs).toISOString(),
        minedAt: shouldExecute ? new Date(minedAtMs).toISOString() : null,
        blockNumber,
        blockTimestamp: new Date(blockTimestampMs).toISOString(),
        latencyMs,
      },
      aggregateMetrics: {
        slippageBps,
        slippagePct: slippageBps / 100,
        amountInRaw: previewTotals.amountIn.toString(),
        amountOutRaw: previewTotals.amountOut.toString(),
        requestedAmountOutMinRaw: previewTotals.clientAmountOutMin.toString(),
        appliedAmountOutMinRaw: previewTotals.appliedAmountOutMin.toString(),
        computedAmountOutMinRaw: previewTotals.computedAmountOutMin.toString(),
        gasUsed: gasUsed.toString(),
        gasPriceWei: gasPriceWei.toString(),
        gasSpentWei: gasSpentWei.toString(),
        gasSpentEth: ethers.formatEther(gasSpentWei),
      },
      previewSummary: {
        blockNumber: previewSummary.blockNumber.toString(),
        blockTimestamp: previewSummary.blockTimestamp.toString(),
        profitToken: previewSummary.profitToken,
        startBalance: previewSummary.startBalance.toString(),
        endBalance: previewSummary.endBalance.toString(),
        profit: previewSummary.profit.toString(),
        totalGasUsed: previewSummary.totalGasUsed.toString(),
        stepsCount: previewSummary.stepsCount.toString(),
      },
      stepLogs: stepLogsRaw,
      stepLogsNormalized,
    };
  }

  private getNetworkConfig(prefix: NetworkPrefix): SwapNetworkConfig {
    const basePath = `swapNetworks.networks.${prefix}`;
    const rpcUrl = this.configService.get<string>(`${basePath}.rpcUrl`) ?? '';
    const executorAddress = this.configService.get<string>(`${basePath}.executorAddress`) ?? '';
    const txUrl = this.configService.get<string>(`${basePath}.txUrl`) ?? '';
    const uniswapV2 = this.configService.get<string>(`${basePath}.routers.uniswapV2`) ?? '';
    const sushiV2 = this.configService.get<string>(`${basePath}.routers.sushiV2`) ?? '';
    const camelotV2 = this.configService.get<string>(`${basePath}.routers.camelotV2`) ?? '';

    // rpcUrl/executorAddress могут быть пустыми в .env и заданы настройками
    // пользователя — валидируются в execute() после мержа overrides.
    if (executorAddress && !ethers.isAddress(executorAddress)) {
      throw new BadRequestException(`Некорректный ${prefix}_EXECUTOR_ADDRESS`);
    }

    if (uniswapV2 && !ethers.isAddress(uniswapV2)) {
      throw new BadRequestException(`Некорректный ${prefix}_UNISWAP_V2_ROUTER`);
    }
    if (sushiV2 && !ethers.isAddress(sushiV2)) {
      throw new BadRequestException(`Некорректный ${prefix}_SUSHI_V2_ROUTER`);
    }
    if (camelotV2 && !ethers.isAddress(camelotV2)) {
      throw new BadRequestException(`Некорректный ${prefix}_CAMELOT_V2_ROUTER`);
    }

    return {
      rpcUrl,
      executorAddress,
      txUrl,
      routers: { uniswapV2, sushiV2, camelotV2 },
    };
  }

  private toContractStep(step: SwapStepDto, amountOutMin: bigint): ArbExecutorStep {
    return {
      kind: step.kind,
      router: step.router,
      path: step.path ?? [],
      pool: step.pool,
      tokenIn: step.tokenIn,
      tokenOut: step.tokenOut,
      amountIn: BigInt(step.amountIn),
      amountOutMin,
      sqrtPriceLimitX96: BigInt(step.sqrtPriceLimitX96 ?? '0'),
      deadline: BigInt(step.deadline ?? '0'),
    };
  }

  private normalizeClientDecimals(
    input: Record<string, number> | undefined,
  ): Map<string, number> {
    const result = new Map<string, number>();
    if (!input) {
      return result;
    }

    for (const [address, decimals] of Object.entries(input)) {
      if (ethers.isAddress(address) && Number.isInteger(decimals) && decimals >= 0 && decimals <= 255) {
        result.set(address.toLowerCase(), decimals);
      }
    }

    return result;
  }
}

