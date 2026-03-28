import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'ID источника (биржи/DEX)', example: 'cex_binance' })
  @IsString()
  @IsNotEmpty()
  sourceId: string;

  @ApiProperty({ description: 'ID торговой пары', example: 'ETH_USDT' })
  @IsString()
  @IsNotEmpty()
  pairId: string;
}

export class ToggleSubscriptionDto {
  @ApiProperty({ description: 'Флаг активности подписки' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

