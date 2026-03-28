import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GetNonceDto } from './dto/get-nonce.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Получить nonce для подписи',
    description:
      'Первый шаг Web3-аутентификации. Принимает адрес кошелька, создаёт или находит пользователя, ' +
      'генерирует одноразовый nonce. Фронтенд должен подписать строку ' +
      '"Войти в ArbiDex\\nNonce: <nonce>" через кошелёк и передать подпись в /auth/verify.',
  })
  @ApiResponse({ status: 200, description: 'Nonce сгенерирован', schema: { example: { nonce: 'uuid-string' } } })
  @ApiResponse({ status: 400, description: 'Некорректный адрес кошелька' })
  getNonce(@Body() dto: GetNonceDto) {
    return this.authService.getNonce(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Верифицировать подпись и получить токены',
    description:
      'Второй шаг Web3-аутентификации. Принимает адрес кошелька и подпись nonce, ' +
      'верифицирует её через ethers.js. При успехе возвращает JWT access-токен (15 мин) ' +
      'и refresh-токен (7 дней), а также данные пользователя.',
  })
  @ApiResponse({
    status: 200,
    description: 'Аутентификация успешна',
    schema: {
      example: {
        accessToken: 'eyJ...',
        refreshToken: 'eyJ...',
        user: { id: 'uuid', walletAddress: '0x...', walletProvider: 'MetaMask' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Некорректная подпись' })
  @ApiResponse({ status: 401, description: 'Подпись не совпадает с адресом' })
  verifySignature(@Body() dto: VerifySignatureDto) {
    return this.authService.verifySignature(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Обновить access-токен',
    description:
      'Принимает refresh-токен и возвращает новую пару токенов (access + refresh). ' +
      'Используется для продления сессии без повторной подписи кошельком.',
  })
  @ApiResponse({ status: 200, description: 'Токены обновлены' })
  @ApiResponse({ status: 401, description: 'Refresh-токен недействителен или истёк' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}

