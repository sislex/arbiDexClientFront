import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ArbiConfigsService } from './arbi-configs.service';
import { CreateArbiConfigDto, UpdateArbiConfigDto } from './dto/arbi-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PricesService } from '../prices/prices.service';

@ApiTags('ArbiConfigs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('arbi-configs')
export class ArbiConfigsController {
  constructor(
    private readonly service: ArbiConfigsService,
    private readonly pricesService: PricesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Список арбитражных конфигов',
    description:
      'Возвращает все арбитражные конфиги текущего пользователя с подгруженными источниками.',
  })
  @ApiResponse({ status: 200, description: 'Массив конфигов' })
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Детали арбитражного конфига',
    description:
      'Возвращает конфиг по ID с подгруженными референсными и торговой подписками.',
  })
  @ApiParam({ name: 'id', description: 'UUID конфига' })
  @ApiResponse({ status: 200, description: 'Конфиг' })
  @ApiResponse({ status: 404, description: 'Конфиг не найден' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Создать арбитражный конфиг',
    description:
      'Создаёт новый конфиг из подписок пользователя. Указываются референсные источники ' +
      '(для расчёта средней цены), торговый источник (DEX для исполнения), ' +
      'актив прибыли и проскальзывание.',
  })
  @ApiResponse({ status: 201, description: 'Конфиг создан' })
  @ApiResponse({ status: 400, description: 'Некорректные данные или подписки не принадлежат пользователю' })
  create(@CurrentUser() user: User, @Body() dto: CreateArbiConfigDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить арбитражный конфиг',
    description: 'Обновляет поля конфига. Можно передавать только изменённые поля.',
  })
  @ApiParam({ name: 'id', description: 'UUID конфига' })
  @ApiResponse({ status: 200, description: 'Конфиг обновлён' })
  @ApiResponse({ status: 404, description: 'Конфиг не найден' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateArbiConfigDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить арбитражный конфиг',
    description: 'Удаляет конфиг по ID. Пользователь может удалять только свои конфиги.',
  })
  @ApiParam({ name: 'id', description: 'UUID конфига' })
  @ApiResponse({ status: 204, description: 'Конфиг удалён' })
  @ApiResponse({ status: 404, description: 'Конфиг не найден' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  @Get(':id/prices')
  @ApiOperation({
    summary: 'Ценовые данные всех подписок конфига',
    description:
      'Загружает исторические bid/ask данные для каждой подписки конфига ' +
      '(все референсные + торговая). Данные кэшируются на 1 час. ' +
      'Для принудительного обновления передайте noCache=true.',
  })
  @ApiParam({ name: 'id', description: 'UUID конфига' })
  @ApiQuery({ name: 'noCache', required: false, type: Boolean, description: 'Игнорировать кэш и обновить данные' })
  @ApiResponse({ status: 200, description: 'Объект с ценовыми данными по каждой подписке' })
  @ApiResponse({ status: 404, description: 'Конфиг не найден' })
  async getPrices(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('noCache') noCache?: string,
  ) {
    const { tradingSubscriptionId, referenceSubscriptionIds, allSubscriptionIds } =
      await this.service.getSubscriptionIds(user.id, id);

    const forceFresh = noCache === 'true';
    const priceResults: Record<string, any> = {};
    for (const subId of allSubscriptionIds) {
      try {
        priceResults[subId] = await this.pricesService.getPricesBySubscription(
          subId,
          user.id,
          forceFresh,
        );
      } catch {
        priceResults[subId] = { series: [], data: [] };
      }
    }

    return {
      tradingSubscriptionId,
      referenceSubscriptionIds,
      prices: priceResults,
    };
  }

  @Post(':id/backtest')
  @ApiOperation({
    summary: 'Запустить бэктест автоторговли',
    description:
      'Прогоняет все исторические ценовые данные конфига через движок автоторговли. ' +
      'Возвращает итоговые балансы, P&L и список всех совершённых сделок.',
  })
  @ApiParam({ name: 'id', description: 'UUID конфига' })
  @ApiResponse({ status: 201, description: 'Результат бэктеста с итогами и списком сделок' })
  @ApiResponse({ status: 400, description: 'Нет исторических данных для бэктеста' })
  @ApiResponse({ status: 404, description: 'Конфиг не найден' })
  runBacktest(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.runBacktest(user.id, id);
  }
}

