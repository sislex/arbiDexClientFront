import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMarketConfigDto {
  @ApiProperty({ example: 'ETH — Uniswap vs CEX' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'dex_arbitrum__WETH_USDC' })
  @IsOptional()
  @IsString()
  tradingMarketId?: string | null;

  @ApiProperty({ type: [String], example: ['cex_binance__ETH_USDT'] })
  @IsArray()
  @IsString({ each: true })
  observedMarketIds: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  useWeightedAverage?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'number' } })
  @IsOptional()
  @IsObject()
  weights?: Record<string, number>;
}

export class UpdateMarketConfigDto extends PartialType(CreateMarketConfigDto) {}
