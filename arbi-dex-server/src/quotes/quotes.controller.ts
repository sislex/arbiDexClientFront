import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuotesService, QuoteDto } from './quotes.service';

@ApiTags('Quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get('latest')
  @ApiOperation({
    summary: 'Последние котировки',
    description:
      'Возвращает последние bid/ask котировки для всех доступных пар из arbiDexMarketData. ' +
      'Данные берутся из snapshot — по одной точке на каждый ключ.',
  })
  @ApiResponse({ status: 200, description: 'Массив котировок' })
  async getLatestQuotes(): Promise<QuoteDto[]> {
    return this.quotesService.getLatestQuotes();
  }
}

