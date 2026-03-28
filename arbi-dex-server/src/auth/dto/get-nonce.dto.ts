import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress } from 'class-validator';

export class GetNonceDto {
  @ApiProperty({
    description: 'Ethereum-адрес кошелька пользователя',
    example: '0x742d35Cc6634C0532925a3b8D4C9B8f3e4F4B3e',
  })
  @IsEthereumAddress()
  walletAddress: string;
}

