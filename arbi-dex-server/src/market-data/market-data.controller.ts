import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketDataService, PoolInfo } from './market-data.service';
import { GetPoolQueryDto } from './dto/get-pool-query.dto';

@ApiTags('MarketData')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly service: MarketDataService) {}

  @Get('pool')
  @ApiOperation({
    summary: 'Метаданные пула (bidPool/askPool)',
    description:
      'Прокси к arbiDexMarketData. Строит ключ ' +
      '`<sourceId>|<baseAddr>/<quoteAddr>|<bidPool|askPool>` и возвращает ' +
      '{ dex, version, poolAddress }. Решает проблему CORS для фронтенда.',
  })
  @ApiResponse({ status: 200, description: 'Метаданные пула' })
  @ApiResponse({ status: 400, description: 'Некорректные параметры или сервис недоступен' })
  getPool(@Query() query: GetPoolQueryDto): Promise<PoolInfo> {
    return this.service.getPool(query.sourceId, query.pairId, query.side);
  }
}
