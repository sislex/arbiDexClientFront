import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecuteSwapDto } from './dto/execute-swap.dto';
import { SwapExecutionService } from './swap-execution.service';

@ApiTags('SwapExecution')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('swap-execution')
export class SwapExecutionController {
  constructor(private readonly swapExecutionService: SwapExecutionService) {}

  // Строгий лимит на исполнение свопов (тратит газ/средства серверного кошелька).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('execute')
  @ApiOperation({
    summary: 'Запустить универсальный своп через ArbExecutor',
    description:
      'Защищённый endpoint (требует JWT) для выполнения executeSwaps в выбранной сети. ' +
      'Отправляет реальную on-chain транзакцию серверным кошельком — доступ только аутентифицированным пользователям. ' +
      'Если в шаге amountOutMin > 0 — используется значение клиента. ' +
      'Если amountOutMin = 0 или не передан — сервер рассчитывает его из preview и slippageBps.',
  })
  @ApiResponse({ status: 201, description: 'Результат preview/исполнения свопа с агрегированными метриками и stepLogs' })
  @ApiResponse({ status: 400, description: 'Некорректный запрос, конфиг сети или ошибка preview/валидации' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация (JWT)' })
  executeSwap(@Body() dto: ExecuteSwapDto) {
    return this.swapExecutionService.execute(dto);
  }
}
