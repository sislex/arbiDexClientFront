import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TradingSettingsService } from './trading-settings.service';
import {
  CreateTradingContractDto,
  CreateUserTokenDto,
  UpdateTradingContractDto,
  UpdateUserTokenDto,
} from './dto/trading-settings.dto';
import type { TradingContractKind } from './entities/user-trading-contract.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class TradingSettingsController {
  constructor(private readonly service: TradingSettingsService) {}

  @Get('contracts')
  @ApiOperation({
    summary: 'Квотер-/executor-контракты пользователя',
    description:
      'Списки контрактов по сетям: у каждой записи свой RPC URL и адрес; записей может быть ' +
      'несколько, торговля использует активную (isActive) запись сети. Нет записей → .env.',
  })
  @ApiQuery({ name: 'kind', required: false, enum: ['quoter', 'executor'] })
  listContracts(@CurrentUser() user: User, @Query('kind') kind?: TradingContractKind) {
    return this.service.listContracts(user.id, kind);
  }

  @Post('contracts')
  @ApiOperation({ summary: 'Добавить квотер/executor (первый в сети становится активным)' })
  createContract(@CurrentUser() user: User, @Body() dto: CreateTradingContractDto) {
    return this.service.createContract(user.id, dto);
  }

  @Patch('contracts/:id')
  @ApiOperation({ summary: 'Изменить контракт (isActive=true снимает флаг с других записей сети)' })
  @ApiParam({ name: 'id' })
  updateContract(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateTradingContractDto) {
    return this.service.updateContract(user.id, id, dto);
  }

  @Delete('contracts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить контракт' })
  @ApiParam({ name: 'id' })
  removeContract(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.removeContract(user.id, id);
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Сопоставление токенов: сеть, адрес, название, decimals' })
  listTokens(@CurrentUser() user: User) {
    return this.service.listTokens(user.id);
  }

  @Post('tokens')
  @ApiOperation({ summary: 'Добавить токен' })
  createToken(@CurrentUser() user: User, @Body() dto: CreateUserTokenDto) {
    return this.service.createToken(user.id, dto);
  }

  @Patch('tokens/:id')
  @ApiOperation({ summary: 'Изменить токен' })
  @ApiParam({ name: 'id' })
  updateToken(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateUserTokenDto) {
    return this.service.updateToken(user.id, id, dto);
  }

  @Delete('tokens/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить токен' })
  @ApiParam({ name: 'id' })
  removeToken(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.removeToken(user.id, id);
  }
}
