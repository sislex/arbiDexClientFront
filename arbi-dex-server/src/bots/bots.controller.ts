import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BotsService } from './bots.service';
import { LiveTradingService } from './live-trading.service';
import { AutotuneJobsService } from './autotune-jobs.service';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';
import { TradeRequestDto } from './dto/trade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Bots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bots')
export class BotsController {
  constructor(
    private readonly service: BotsService,
    private readonly liveTrading: LiveTradingService,
    private readonly autotuneJobs: AutotuneJobsService,
  ) {}

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

  @Get(':id/quotes')
  @ApiOperation({
    summary: 'Реальные котировки рынка бота за период (без прогона)',
    description:
      'История котировок рынка бота за [from, to] для предпросмотра периода на графике. ' +
      'Семантика окна как у бэктеста: по умолчанию последняя неделя, границы зажимаются ' +
      'в пределы доступной истории. Демосчёт не трогает. refresh=1 — обновить кэш ' +
      'котировок по всем рынкам конфигурации перед чтением.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'from', required: false, description: 'Начало периода (метка времени)' })
  @ApiQuery({ name: 'to', required: false, description: 'Конец периода (метка времени)' })
  @ApiQuery({ name: 'refresh', required: false, description: '1 — обновить кэш котировок конфигурации рынка' })
  quotes(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.service.quotesRange(user.id, id, {
      from: from !== undefined ? Number(from) : undefined,
      to: to !== undefined ? Number(to) : undefined,
      refresh: refresh === '1' || refresh === 'true',
    });
  }

  @Post(':id/trade')
  @ApiOperation({
    summary: 'Ручная live-сделка (купить/продать)',
    description:
      'Демо-режим: котировка через квотер (preview executeSwaps.staticCall executor-контракта), ' +
      'проверка допустимого проскальзывания bot.slippagePct против expectedPrice; при превышении ' +
      'сделка записывается как зафейленная и счёт не меняется. Реальный режим: своп исполняется ' +
      'on-chain через executor, защита от проскальзывания — on-chain amountOutMin.',
  })
  @ApiParam({ name: 'id' })
  trade(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: TradeRequestDto) {
    return this.liveTrading.trade(user.id, id, dto);
  }

  @Get(':id/trades')
  @ApiOperation({ summary: 'Журнал live-сделок бота (успешные и зафейленные)' })
  @ApiParam({ name: 'id' })
  trades(@CurrentUser() user: User, @Param('id') id: string) {
    return this.liveTrading.listTrades(user.id, id);
  }

  @Post(':id/reset-account')
  @ApiOperation({
    summary: 'Обнулить демосчёт бота',
    description:
      'Баланс возвращается к начальному, позиция/PnL/счётчики сбрасываются, журнал ' +
      'демо-сделок очищается (реальные сделки остаются). Возвращает обновлённого бота.',
  })
  @ApiParam({ name: 'id' })
  resetAccount(@CurrentUser() user: User, @Param('id') id: string) {
    return this.liveTrading.resetAccount(user.id, id);
  }

  @Get(':id/executor-balance')
  @ApiOperation({
    summary: 'Балансы executor-контракта по токенам пары бота',
    description:
      'Текущие балансы токенов торговой пары на executor-контракте (адрес из настроек ' +
      'пользователя, fallback — .env). Фронт запрашивает при каждом заходе на реальную торговлю.',
  })
  @ApiParam({ name: 'id' })
  executorBalance(@CurrentUser() user: User, @Param('id') id: string) {
    return this.liveTrading.executorBalances(user.id, id);
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
    @Body() body?: { params?: Record<string, number> },
  ) {
    return this.service.backtest(user.id, id, {
      from: from !== undefined ? Number(from) : undefined,
      to: to !== undefined ? Number(to) : undefined,
      // Коэффициенты комбо автоподбора поверх стратегии (опционально).
      params: body?.params,
    });
  }

  @Get(':id/step-result')
  @ApiOperation({
    summary: 'Результат стратегии на одном шаге (сигналы + разбор условий)',
    description:
      'Прогоняет стратегию бота через движок (@sislex/arbi-conditions-libs) на одном ' +
      'шаге — ближайшем к `time` (не позже него; по умолчанию последний шаг истории). ' +
      'Более ранняя история подаётся в lookback-условия. Возвращает сигналы ' +
      '`transaction.buy/sell/forcedSell` и разбор каждого условия ' +
      '(`condition.buy/sell` c passed/actual/required). Демосчёт бота не меняет. ' +
      'Sell-триггерам (stop-loss / trailing TP / max holding) нужна открытая позиция — ' +
      'передайте `entryPrice` (и опционально `openedAt`), чтобы её смоделировать.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'time', required: false, description: 'Метка времени шага (в единицах данных); по умолчанию — последний шаг' })
  @ApiQuery({ name: 'entryPrice', required: false, description: 'Цена входа моделируемой позиции (для sell-триггеров)' })
  @ApiQuery({ name: 'openedAt', required: false, description: 'Время открытия позиции; по умолчанию — первый шаг истории' })
  @ApiQuery({ name: 'size', required: false, description: 'Размер позиции в токене (по умолчанию 0)' })
  stepResult(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('time') time?: string,
    @Query('entryPrice') entryPrice?: string,
    @Query('openedAt') openedAt?: string,
    @Query('size') size?: string,
  ) {
    return this.service.stepResult(user.id, id, {
      time: time !== undefined ? Number(time) : undefined,
      entryPrice: entryPrice !== undefined ? Number(entryPrice) : undefined,
      openedAt: openedAt !== undefined ? Number(openedAt) : undefined,
      size: size !== undefined ? Number(size) : undefined,
    });
  }

  @Post(':id/autotune-estimate')
  @ApiOperation({
    summary: 'Оценка автоподбора: число прогонов и прогноз времени',
    description:
      'Считает размер сетки комбинаций и число реальных прогонов, замеряет ОДИН бэктест по ' +
      'текущим коэффициентам и умножает на число прогонов с учётом потоков. Перебор не запускает.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'maxCombos', required: false })
  @ApiQuery({ name: 'threads', required: false })
  autotuneEstimate(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('maxCombos') maxCombos?: string,
    @Query('threads') threads?: string,
  ) {
    return this.service.autotuneEstimate(user.id, id, {
      from: from !== undefined ? Number(from) : undefined,
      to: to !== undefined ? Number(to) : undefined,
      maxCombos: maxCombos !== undefined ? Number(maxCombos) : undefined,
      threads: threads !== undefined ? Number(threads) : undefined,
    });
  }

  @Post(':id/autotune/start')
  @ApiOperation({
    summary: 'Запустить автоподбор в фоне (прогресс — по вебсокету /autotune-progress)',
    description:
      'Сразу возвращает jobId; перебор идёт в worker_threads, готовые прогоны стримятся в ' +
      'реестр задач. Подключитесь к namespace /autotune-progress (auth.token + query.jobId) — ' +
      'раз в секунду приходит снапшот: done/total и top-500 лучших прогонов.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'maxCombos', required: false })
  @ApiQuery({ name: 'initialBalance', required: false })
  @ApiQuery({ name: 'threads', required: false, description: 'Сколько потоков пула занять этим расчётом' })
  autotuneStart(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('maxCombos') maxCombos?: string,
    @Query('initialBalance') initialBalance?: string,
    @Query('threads') threads?: string,
  ) {
    return this.service.autotuneStart(user.id, id, {
      from: from !== undefined ? Number(from) : undefined,
      to: to !== undefined ? Number(to) : undefined,
      maxCombos: maxCombos !== undefined ? Number(maxCombos) : undefined,
      initialBalance: initialBalance !== undefined ? Number(initialBalance) : undefined,
      threads: threads !== undefined ? Number(threads) : undefined,
    });
  }

  @Get(':id/autotune/jobs/:jobId')
  @ApiOperation({ summary: 'Снапшот фоновой задачи автоподбора (страховка к вебсокету)' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'jobId' })
  autotuneJob(@CurrentUser() user: User, @Param('jobId') jobId: string) {
    return this.autotuneJobs.get(user.id, jobId);
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
  @ApiQuery({ name: 'threads', required: false, description: 'Потоков перебора (по умолчанию min(6, ядра−1))' })
  @ApiQuery({ name: 'initialBalance', required: false, description: 'Начальный баланс прогонов (по умолчанию — баланс бота)' })
  autotune(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('maxCombos') maxCombos?: string,
    @Query('threads') threads?: string,
    @Query('initialBalance') initialBalance?: string,
  ) {
    return this.service.autotune(user.id, id, {
      from: from !== undefined ? Number(from) : undefined,
      to: to !== undefined ? Number(to) : undefined,
      maxCombos: maxCombos !== undefined ? Number(maxCombos) : undefined,
      threads: threads !== undefined ? Number(threads) : undefined,
      initialBalance: initialBalance !== undefined ? Number(initialBalance) : undefined,
    });
  }
}
