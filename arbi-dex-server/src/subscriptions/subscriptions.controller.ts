import {
  Controller, Get, Post, Delete, Patch, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Список подписок пользователя',
    description: 'Возвращает все подписки текущего авторизованного пользователя, отсортированные по дате создания (новые первыми).',
  })
  @ApiResponse({ status: 200, description: 'Массив подписок' })
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Создать подписку',
    description: 'Создаёт новую подписку на пару (sourceId + pairId) для текущего пользователя. Подписка создаётся активной (enabled: true).',
  })
  @ApiResponse({ status: 201, description: 'Подписка создана' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  create(@CurrentUser() user: User, @Body() dto: CreateSubscriptionDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({
    summary: 'Переключить активность подписки',
    description: 'Инвертирует флаг enabled у подписки. Если была активна — деактивирует, и наоборот.',
  })
  @ApiParam({ name: 'id', description: 'UUID подписки' })
  @ApiResponse({ status: 200, description: 'Подписка обновлена' })
  @ApiResponse({ status: 404, description: 'Подписка не найдена' })
  toggle(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.toggle(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить подписку',
    description: 'Удаляет подписку по ID. Пользователь может удалять только собственные подписки.',
  })
  @ApiParam({ name: 'id', description: 'UUID подписки' })
  @ApiResponse({ status: 204, description: 'Подписка удалена' })
  @ApiResponse({ status: 404, description: 'Подписка не найдена' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}

