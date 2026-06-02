import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';

export enum PoolSide {
  BID = 'bid',
  ASK = 'ask',
}

export class GetPoolQueryDto {
  @ApiProperty({ description: 'Источник торговли', example: 'dex:arbitrum' })
  @IsString()
  sourceId: string;

  @ApiProperty({ description: 'Идентификатор пары', example: 'WETH_USDC' })
  @IsString()
  @Matches(/^[^_]+_[^_]+$/, { message: 'pairId должен быть в формате BASE_QUOTE' })
  pairId: string;

  @ApiProperty({
    description: 'Сторона пула: bid (продажа base) / ask (покупка base)',
    enum: PoolSide,
    example: PoolSide.ASK,
  })
  @IsIn([PoolSide.BID, PoolSide.ASK])
  side: PoolSide;
}
