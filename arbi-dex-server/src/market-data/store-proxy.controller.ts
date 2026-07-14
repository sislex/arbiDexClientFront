import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketDataService } from './market-data.service';

@ApiTags('Store')
@Controller('store')
export class StoreProxyController {
  constructor(private readonly service: MarketDataService) {}

  @Get('keys')
  @ApiOperation({
    summary: 'Список ключей PriceStore',
    description: 'Прокси → arbiDexMarketData GET /store/keys (без CORS для фронтенда).',
  })
  getKeys(): Promise<string[]> {
    return this.service.getStoreKeys();
  }

  @Post('keys')
  @ApiOperation({
    summary: 'Серии цен по ключам',
    description: 'Прокси → arbiDexMarketData POST /store/keys (без CORS для фронтенда).',
  })
  postKeys(@Body() body: { keys: string[]; limit?: number }) {
    return this.service.postStoreKeys(body);
  }
}
