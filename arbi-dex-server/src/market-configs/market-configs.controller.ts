import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MarketConfigsService } from './market-configs.service';
import { CreateMarketConfigDto, UpdateMarketConfigDto } from './dto/market-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('MarketConfigs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('market-configs')
export class MarketConfigsController {
  constructor(private readonly service: MarketConfigsService) {}

  @Get()
  @ApiOperation({ summary: 'Список конфигураций рынков пользователя' })
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Конфигурация рынков по id' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать конфигурацию рынков' })
  @ApiResponse({ status: 201 })
  create(@CurrentUser() user: User, @Body() dto: CreateMarketConfigDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить конфигурацию рынков' })
  @ApiParam({ name: 'id' })
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateMarketConfigDto) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить конфигурацию рынков' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  @Get(':id/history-range')
  @ApiOperation({ summary: 'Границы доступной истории котировок торгового рынка конфигурации' })
  @ApiParam({ name: 'id' })
  historyRange(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.getHistoryRange(user.id, id);
  }

  @Get(':id/follow-analysis')
  @ApiOperation({
    summary: 'Как часто торговый рынок следует за наблюдаемыми (в %)',
    description:
      'Пробегает шаги конфигурации за период [from, to] (по умолчанию последняя неделя, ' +
      'границы зажимаются в пределы истории). Событие — изменение средневзвешенной ' +
      'наблюдаемой цены на ≥ movePct% за шаг; следование — движение mid торгового рынка ' +
      'в ту же сторону на ≥ movePct% от уровня до события в течение window шагов. ' +
      'Возвращает followRate (всего и по направлениям), среднюю задержку и время расчёта.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'movePct', required: false, description: 'Порог значимого движения, % (по умолчанию 0.05)' })
  @ApiQuery({ name: 'window', required: false, description: 'Окно ожидания, шагов (по умолчанию 5)' })
  @ApiQuery({ name: 'from', required: false, description: 'Начало периода (метка времени)' })
  @ApiQuery({ name: 'to', required: false, description: 'Конец периода (метка времени)' })
  followAnalysis(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('movePct') movePct?: string,
    @Query('window') window?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.followAnalysis(user.id, id, {
      movePct: movePct !== undefined ? Number(movePct) : undefined,
      window: window !== undefined ? Number(window) : undefined,
      from: from !== undefined ? Number(from) : undefined,
      to: to !== undefined ? Number(to) : undefined,
    });
  }

  @Get(':id/quotes')
  @ApiOperation({ summary: 'Серия котировок для графика (демо, детерминированная)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'count', required: false })
  @ApiQuery({ name: 'intervalSec', required: false })
  getQuotes(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('count') count?: string,
    @Query('intervalSec') intervalSec?: string,
  ) {
    return this.service.getQuotes(
      user.id,
      id,
      count ? Number(count) : undefined,
      intervalSec ? Number(intervalSec) : undefined,
    );
  }
}
