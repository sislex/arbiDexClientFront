import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VerifySignatureDto {
  @ApiProperty({
    description: 'Ethereum-адрес кошелька',
    example: '0x742d35Cc6634C0532925a3b8D4C9B8f3e4F4B3e',
  })
  @IsEthereumAddress()
  walletAddress: string;

  @ApiProperty({
    description: 'Подпись nonce кошельком (hex-строка)',
    example: '0xabc123...',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Провайдер кошелька',
    example: 'MetaMask',
    required: false,
    enum: ['MetaMask', 'WalletConnect', 'CoinbaseWallet'],
  })
  @IsOptional()
  @IsString()
  walletProvider?: string;
}

