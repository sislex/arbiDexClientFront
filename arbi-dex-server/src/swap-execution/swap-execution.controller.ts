import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExecuteSwapDto } from './dto/execute-swap.dto';
import { SwapExecutionService } from './swap-execution.service';

@ApiTags('SwapExecution')
@Controller('swap-execution')
export class SwapExecutionController {
  constructor(private readonly swapExecutionService: SwapExecutionService) {}

  @Post('execute')
  @ApiOperation({
    summary: 'Запустить универсальный своп через ArbExecutor',
    description:
      'Публичный endpoint для выполнения executeSwaps в выбранной сети. ' +
      'Если в шаге amountOutMin > 0 — используется значение клиента. ' +
      'Если amountOutMin = 0 или не передан — сервер рассчитывает его из preview и slippageBps.',
  })
  @ApiResponse({ status: 201, description: 'Результат preview/исполнения свопа с агрегированными метриками и stepLogs' })
  @ApiResponse({ status: 400, description: 'Некорректный запрос, конфиг сети или ошибка preview/валидации' })
  executeSwap(@Body() dto: ExecuteSwapDto) {
    return this.swapExecutionService.execute(dto);
  }
}

