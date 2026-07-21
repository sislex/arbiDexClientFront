import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import type { BotStatus, TradingMode } from '../../demo/engine/types';

const STATUSES: BotStatus[] = ['running', 'paused', 'stopped', 'error'];
const MODES: TradingMode[] = ['demo-live', 'real-live', 'idle'];

export class CreateBotDto {
  @ApiProperty({ example: 'ETH Arb #1' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'demo-live' })
  @IsOptional()
  @IsIn(MODES)
  mode?: TradingMode;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: BotStatus;

  @ApiProperty()
  @IsUUID()
  marketConfigId: string;

  @ApiProperty()
  @IsUUID()
  strategyConfigId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseAsset?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quoteAsset?: string;

  @ApiPropertyOptional({ default: 1000 })
  @IsOptional()
  @IsNumber()
  initialBalance?: number;

  @ApiPropertyOptional({
    default: 0.5,
    description: 'Допустимое проскальзывание live-сделок, % (0.5 = 0.5%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  slippagePct?: number;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Порог пыли в валюте баланса: при старте сессии открытая позиция дешевле ' +
      'этого значения считается закрытой (0 = выключено).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPositionValue?: number;
}

export class UpdateBotDto extends PartialType(CreateBotDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openPosition?: boolean;

  // Ручная правка демосчёта (сброс после экспериментов с live-торговлей).
  @ApiPropertyOptional({ description: 'Демо-баланс (quote-актив)' })
  @IsOptional()
  @IsNumber()
  balance?: number;

  @ApiPropertyOptional({ description: 'Размер открытой позиции (base-актив)' })
  @IsOptional()
  @IsNumber()
  positionSize?: number;

  @ApiPropertyOptional({ description: 'Цена входа открытой позиции' })
  @IsOptional()
  @IsNumber()
  entryPrice?: number;
}
