import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
      'Данные запрашиваются из arbiDexServerBots на основе маппинга sourceId+pairId → PriceStore keys.',
  })
  @ApiParam({ name: 'subscriptionId', description: 'UUID подписки' })
  @ApiResponse({ status: 200, description: 'Объект с массивом серий и массивом ценовых точек' })
  @ApiResponse({ status: 400, description: 'Маппинг не найден или сервер котировок недоступен' })
  @ApiResponse({ status: 404, description: 'Подписка не найдена' })
  getPricesBySubscription(
    @CurrentUser() user: User,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.service.getPricesBySubscription(subscriptionId, user.id);
  }
}

