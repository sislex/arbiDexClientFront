import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEthereumAddress,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { TradingContractKind } from '../entities/user-trading-contract.entity';

export class CreateTradingContractDto {
  @ApiProperty({ enum: ['quoter', 'executor'], description: 'Тип контракта' })
  @IsIn(['quoter', 'executor'])
  kind: TradingContractKind;

  @ApiProperty({ description: 'Префикс сети: ARBITRUM | OPTIMISM | BASE' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  network: string;

  @ApiPropertyOptional({ description: 'Название записи' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ description: 'RPC URL (пусто → <PREFIX>_RPC из .env)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  rpcUrl?: string;

  @ApiProperty({ description: 'Адрес контракта' })
  @IsEthereumAddress()
  address: string;

  @ApiPropertyOptional({ description: 'Сделать активным для сети', default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTradingContractDto extends PartialType(CreateTradingContractDto) {}

export class CreateUserTokenDto {
  @ApiProperty({ description: 'Префикс сети: ARBITRUM | OPTIMISM | BASE' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  network: string;

  @ApiProperty({ description: 'Адрес контракта токена' })
  @IsEthereumAddress()
  address: string;

  @ApiProperty({ description: 'Название/символ токена (WETH, USDC, …)' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  symbol: string;

  @ApiPropertyOptional({ default: 18 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(36)
  decimals?: number;
}

export class UpdateUserTokenDto extends PartialType(CreateUserTokenDto) {}
