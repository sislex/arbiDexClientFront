import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Получить настройки пользователя',
    description:
      'Возвращает пользовательские настройки интерфейса: тему (light/dark), ' +
      'плотность (default/compact) и состояние бокового меню. ' +
      'Если настройки ещё не созданы — возвращает дефолтные значения.',
  })
  @ApiResponse({
    status: 200,
    description: 'Настройки пользователя',
    schema: {
      example: { id: 'uuid', userId: 'uuid', theme: 'light', density: 'default', sidebarOpened: true },
    },
  })
  getSettings(@CurrentUser() user: User) {
    return this.service.findByUser(user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Обновить настройки пользователя',
    description:
      'Частичное обновление настроек (PATCH). Можно передавать любое сочетание полей: ' +
      'theme, density, sidebarOpened. Непереданные поля остаются без изменений.',
  })
  @ApiResponse({ status: 200, description: 'Настройки обновлены' })
  @ApiResponse({ status: 400, description: 'Некорректные значения' })
  updateSettings(@CurrentUser() user: User, @Body() dto: UpdateSettingsDto) {
    return this.service.update(user.id, dto);
  }
}

