import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BotsService } from './bots.service';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Bots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bots')
export class BotsController {
  constructor(private readonly service: BotsService) {}

  @Get()
  @ApiOperation({ summary: 'Список ботов пользователя' })
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Бот по id' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать бота (связать конфигурацию рынков и стратегию)' })
  @ApiResponse({ status: 201 })
  create(@CurrentUser() user: User, @Body() dto: CreateBotDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить бота (статус/режим и т.п.)' })
  @ApiParam({ name: 'id' })
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateBotDto) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить бота' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  @Get(':id/history-range')
  @ApiOperation({ summary: 'Границы доступной истории котировок рынка бота (для выбора периода)' })
  @ApiParam({ name: 'id' })
  historyRange(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.historyRange(user.id, id);
  }

  @Post(':id/backtest')
  @ApiOperation({
    summary: 'Бэктест стратегии за период (обновляет демосчёт)',
    description:
      'Прогоняет стратегию бота через общий движок (@sislex/arbi-conditions-libs) ' +
      'на реальных исторических котировках рынка за период [from, to]. По умолчанию ' +
      'период — последняя неделя истории; границы можно двигать от начала истории до ' +
      'последнего тика. from/to — метки времени в единицах данных (мс/сек).',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'from', required: false, description: 'Начало периода (метка времени)' })
  @ApiQuery({ name: 'to', required: false, description: 'Конец периода (метка времени)' })
  backtest(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.backtest(user.id, id, {
      from: from !== undefined ? Number(from) : undefined,
      to: to !== undefined ? Number(to) : undefined,
    });
  }

  @Post(':id/autotune')
  @ApiOperation({
    summary: 'Авто-подбор коэффициентов за период (движок стратегии)',
    description:
      'Перебирает комбинации настраиваемых коэффициентов стратегии, прогоняя каждую ' +
      'через общий движок (@sislex/arbi-conditions-libs) на реальных котировках за ' +
      'период [from, to] (по умолчанию — последняя неделя). Ранжирует по PnL.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'from', required: false, description: 'Начало периода (метка времени)' })
  @ApiQuery({ name: 'to', required: false, description: 'Конец периода (метка времени)' })
  @ApiQuery({ name: 'maxCombos', required: false })
  autotune(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('maxCombos') maxCombos?: string,
  ) {
    return this.service.autotune(user.id, id, {
      from: from !== undefined ? Number(from) : undefined,
      to: to !== undefined ? Number(to) : undefined,
      maxCombos: maxCombos !== undefined ? Number(maxCombos) : undefined,
    });
  }
}
