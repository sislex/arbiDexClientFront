import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get('sources')
  @ApiOperation({
    summary: 'Список источников котировок',
    description:
      'Возвращает все активные источники данных (биржи и DEX): ' +
      'Arbitrum DEX, Binance, MEXC, Bybit и др. ' +
      'Используется для заполнения фильтров и выбора источника при создании подписки.',
  })
  @ApiResponse({
    status: 200,
    description: 'Массив источников',
    schema: {
      example: [{ id: 'cex_binance', name: 'cex_binance', displayName: 'Binance', type: 'cex', isActive: true }],
    },
  })
  getSources() {
    return this.service.getSources();
  }

  @Get('pairs')
  @ApiOperation({
    summary: 'Список торговых пар',
    description:
      'Возвращает все доступные торговые пары (например, ETH/USDT, WBTC/USDC). ' +
      'Используется для выбора пары при создании подписки и в фильтрах Market-страницы.',
  })
  @ApiResponse({
    status: 200,
    description: 'Массив торговых пар',
    schema: {
      example: [{ id: 'ETH_USDT', base: 'ETH', quote: 'USDT', displayName: 'ETH/USDT' }],
    },
  })
  getPairs() {
    return this.service.getPairs();
  }
}

