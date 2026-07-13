import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
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
}

export class UpdateBotDto extends PartialType(CreateBotDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openPosition?: boolean;
}
