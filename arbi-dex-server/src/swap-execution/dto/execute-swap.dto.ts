import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsEthereumAddress,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const UINT_REGEX = /^\d+$/;
// Sanity bound on raw uint amounts (defense-in-depth against pathological inputs).
// NOT a business limit: a real per-token cap needs product input and token decimals.
const RAW_AMOUNT_MAX_DIGITS = 40;

export enum NetworkPrefix {
  ARBITRUM = 'ARBITRUM',
  OPTIMISM = 'OPTIMISM',
  BASE = 'BASE',
}

export class SwapStepDto {
  @ApiProperty({ description: 'Тип шага (enum SwapKind в контракте)', example: 1 })
  @IsInt()
  @Min(0)
  @Max(255)
  kind: number;

  @ApiProperty({ description: 'Адрес router (ZeroAddress для pool-свопов)', example: '0x0000000000000000000000000000000000000000' })
  @IsEthereumAddress()
  router: string;

  @ApiProperty({
    description: 'Маршрут токенов для router-свопов',
    type: [String],
    required: false,
    example: [],
  })
  @IsArray()
  @IsEthereumAddress({ each: true })
  @IsOptional()
  path?: string[];

  @ApiProperty({ description: 'Адрес pool (для pool-свопов)', example: '0xbE3aD6a5669Dc0B8b12FeBC03608860C31E2eef6' })
  @IsEthereumAddress()
  pool: string;

  @ApiProperty({ description: 'Адрес входного токена', example: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9' })
  @IsEthereumAddress()
  tokenIn: string;

  @ApiProperty({ description: 'Адрес выходного токена', example: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' })
  @IsEthereumAddress()
  tokenOut: string;

  @ApiProperty({ description: 'Сумма входа в raw-единицах токена (uint256)', example: '1000000' })
  @IsString()
  @Matches(UINT_REGEX)
  @MaxLength(RAW_AMOUNT_MAX_DIGITS)
  amountIn: string;

  @ApiPropertyOptional({
    description:
      'Минимальный выход шага в raw-единицах (uint256). Если > 0 — приоритет клиента. Если 0 или не передан — сервер посчитает по preview и slippageBps.',
    example: '0',
  })
  @IsOptional()
  @IsString()
  @Matches(UINT_REGEX)
  amountOutMin?: string;

  @ApiPropertyOptional({ description: 'Лимит цены для V3 (uint160)', example: '0' })
  @IsOptional()
  @IsString()
  @Matches(UINT_REGEX)
  sqrtPriceLimitX96?: string;

  @ApiPropertyOptional({ description: 'Unix deadline (uint256)', example: '0' })
  @IsOptional()
  @IsString()
  @Matches(UINT_REGEX)
  deadline?: string;
}

export class ExecuteSwapDto {
  @ApiProperty({
    description: 'Префикс сети для выбора <PREFIX>_RPC / <PREFIX>_EXECUTOR_ADDRESS / <PREFIX>_TX_URL',
    enum: NetworkPrefix,
    example: NetworkPrefix.ARBITRUM,
  })
  @IsEnum(NetworkPrefix)
  networkPrefix: NetworkPrefix;

  @ApiProperty({ description: 'Шаги для executeSwaps', type: [SwapStepDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SwapStepDto)
  steps: SwapStepDto[];

  @ApiProperty({ description: 'Токен профита (profitToken)', example: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' })
  @IsEthereumAddress()
  profitToken: string;

  @ApiPropertyOptional({ description: 'Проскальзывание в bps (50 = 0.5%)', example: 50, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  slippageBps?: number;

  @ApiPropertyOptional({ description: 'Флаг отправки on-chain транзакции', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  execute?: boolean;

  @ApiPropertyOptional({ description: 'Прокинуть revertIfLoss в executeSwaps', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  revertIfLoss?: boolean;

  @ApiPropertyOptional({ description: 'Прокинуть emitEvents в executeSwaps', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  emitEvents?: boolean;

  @ApiPropertyOptional({
    description: 'Опциональные decimals по токенам (адрес -> decimals), чтобы не делать on-chain decimals() запросы',
    example: { '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 6 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsOptional()
  tokenDecimalsByAddress?: Record<string, number>;
}


