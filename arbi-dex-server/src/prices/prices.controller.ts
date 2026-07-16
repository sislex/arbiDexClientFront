import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PricesService } from './prices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Prices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prices')
export class PricesController {
  constructor(private readonly service: PricesService) {}

  @Get('subscription/:subscriptionId')
  @ApiOperation({
    summary: 'Ценовые данные по подписке',
    description:
      'Возвращает историю цен (bid/ask) для указанной подписки. ' +
      'Данные кэшируются на 1 час. Для принудительного обновления передайте noCache=true.',
  })
  @ApiParam({ name: 'subscriptionId', description: 'UUID подписки' })
  @ApiQuery({ name: 'noCache', required: false, type: Boolean, description: 'Игнорировать кэш и обновить данные' })
  @ApiResponse({ status: 200, description: 'Объект с массивом серий и массивом ценовых точек' })
  @ApiResponse({ status: 400, description: 'Маппинг не найден или сервер котировок недоступен' })
  @ApiResponse({ status: 404, description: 'Подписка не найдена' })
  getPricesBySubscription(
    @CurrentUser() user: User,
    @Param('subscriptionId') subscriptionId: string,
    @Query('noCache') noCache?: string,
  ) {
    return this.service.getPricesBySubscription(subscriptionId, user.id, noCache === 'true');
  }

  @Get('market')
  @ApiOperation({
    summary: 'Реальные ценовые данные по рынку (source + pair)',
    description:
      'Возвращает реальную историю bid/ask (DEX) или mid (CEX) из arbiDexMarketData ' +
      'по sourceId и pairId — без подписки. Для страницы конфигурации рынков.',
  })
  @ApiQuery({ name: 'sourceId', example: 'binance' })
  @ApiQuery({ name: 'pairId', example: 'BTC_USDT' })
  @ApiQuery({ name: 'noCache', required: false, type: Boolean })
  @ApiQuery({ name: 'maxPoints', required: false, description: 'Проредить до N точек (по умолчанию 2000 для превью)' })
  @ApiResponse({ status: 200, description: 'Серии + ценовые точки' })
  getPricesByMarket(
    @Query('sourceId') sourceId: string,
    @Query('pairId') pairId: string,
    @Query('noCache') noCache?: string,
    @Query('maxPoints') maxPoints?: string,
  ) {
    // Превью на фронте прорежено (полная серия — сотни тысяч точек JSON);
    // серверная торговля ботов ходит в PricesService напрямую без лимита.
    const max = maxPoints !== undefined ? Number(maxPoints) : 2000;
    return this.service.getPricesByMarket(sourceId, pairId, noCache === 'true', max > 0 ? max : undefined);
  }
}

