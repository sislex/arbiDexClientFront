import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsString, MinLength } from 'class-validator';
import type { StrategyConditionValue } from '../../demo/engine/types';

export class CreateStrategyConfigDto {
  @ApiProperty({ example: 'Консервативная' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Условия покупки' })
  @IsArray()
  buy: StrategyConditionValue[];

  @ApiProperty({ type: 'array', items: { type: 'object' }, description: 'Условия продажи' })
  @IsArray()
  sell: StrategyConditionValue[];
}

export class UpdateStrategyConfigDto extends PartialType(CreateStrategyConfigDto) {}
