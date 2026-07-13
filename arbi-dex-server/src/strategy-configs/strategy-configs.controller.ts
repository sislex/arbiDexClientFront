import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StrategyConfigsService } from './strategy-configs.service';
import { CreateStrategyConfigDto, UpdateStrategyConfigDto } from './dto/strategy-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('StrategyConfigs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('strategy-configs')
export class StrategyConfigsController {
  constructor(private readonly service: StrategyConfigsService) {}

  @Get()
  @ApiOperation({ summary: 'Список стратегий пользователя' })
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.id);
  }

  @Get('defaults')
  @ApiOperation({ summary: 'Стратегия по умолчанию (из каталога условий)' })
  defaults() {
    return this.service.defaults();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Стратегия по id' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать стратегию' })
  @ApiResponse({ status: 201 })
  create(@CurrentUser() user: User, @Body() dto: CreateStrategyConfigDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить стратегию' })
  @ApiParam({ name: 'id' })
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateStrategyConfigDto) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить стратегию' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}
