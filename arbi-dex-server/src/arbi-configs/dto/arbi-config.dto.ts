import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUUID,
  IsNumber,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';

export class CreateArbiConfigDto {
  @ApiProperty({ description: 'Название конфига', example: 'ETH арбитраж CEX→DEX' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'UUID подписки-торгового источника (DEX)',
    example: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  })
  @IsUUID()
  tradingSubscriptionId: string;

  @ApiProperty({
    description: 'UUID подписок-референсных источников (CEX)',
    example: ['11111111-2222-3333-4444-555555555555'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  referenceSubscriptionIds: string[];

  @ApiProperty({ description: 'Актив для фиксации прибыли', example: 'USDC' })
  @IsString()
  @IsNotEmpty()
  profitAsset: string;

  @ApiProperty({ description: 'Проскальзывание (0–1, например 0.01 = 1%)', example: 0.01 })
  @IsNumber()
  @Min(0)
  @Max(1)
  slippage: number;

  @ApiPropertyOptional({ description: 'Начальный баланс для бэктеста', example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;

  @ApiPropertyOptional({ description: 'Порог автопокупки: на сколько % цена торгуемого ниже средней reference', example: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  autoBuyThresholdPct?: number;

  @ApiPropertyOptional({ description: 'Порог автопродажи: на сколько % цена торгуемого выше средней reference', example: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  autoSellThresholdPct?: number;

  @ApiPropertyOptional({ description: 'Trailing take-profit: % отката от максимума цены продажи', example: 1.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  trailingTakeProfitPct?: number;

  @ApiPropertyOptional({ description: 'Стоп-лосс: % убытка от цены покупки', example: 5.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  stopLossPct?: number;

  @ApiPropertyOptional({ description: '% от баланса для каждой сделки', example: 100, default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tradeAmountPct?: number;
}

export class UpdateArbiConfigDto {
  @ApiPropertyOptional({ description: 'Название конфига' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'UUID подписки-торгового источника' })
  @IsOptional()
  @IsUUID()
  tradingSubscriptionId?: string;

  @ApiPropertyOptional({ description: 'UUID подписок-референсных источников', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  referenceSubscriptionIds?: string[];

  @ApiPropertyOptional({ description: 'Актив для фиксации прибыли' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  profitAsset?: string;

  @ApiPropertyOptional({ description: 'Проскальзывание (0–1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  slippage?: number;

  @ApiPropertyOptional({ description: 'Начальный баланс' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;

  @ApiPropertyOptional({ description: 'Порог автопокупки (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  autoBuyThresholdPct?: number;

  @ApiPropertyOptional({ description: 'Порог автопродажи (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  autoSellThresholdPct?: number;

  @ApiPropertyOptional({ description: 'Trailing take-profit (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  trailingTakeProfitPct?: number;

  @ApiPropertyOptional({ description: 'Стоп-лосс (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  stopLossPct?: number;

  @ApiPropertyOptional({ description: '% от баланса для сделки' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tradeAmountPct?: number;
}

