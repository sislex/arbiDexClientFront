import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator';
import type { Side } from '../../demo/engine/types';

export class TradeRequestDto {
  @ApiProperty({ enum: ['buy', 'sell'], description: 'Сторона сделки' })
  @IsIn(['buy', 'sell'])
  side: Side;

  @ApiPropertyOptional({
    description:
      'Котировка, которую видел пользователь в момент клика (quote за base) — база для проверки проскальзывания. Без неё демо-сделка идёт по рынку.',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  expectedPrice?: number;

  @ApiPropertyOptional({
    description:
      'Сумма входа: quote-актив для покупки, base-актив для продажи. По умолчанию — весь баланс/вся позиция.',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
