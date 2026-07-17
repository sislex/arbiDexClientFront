import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { AutotuneJobsService } from './autotune-jobs.service';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class UpdateComputeConfigDto {
  @IsInt()
  @Min(1)
  @Max(64)
  totalThreads: number;
}

/**
 * Меню расчётов: все фоновые задачи пользователя (идущие/в очереди/на паузе/
 * завершённые), пауза/резюме и конфигурация пула потоков сервера.
 */
@ApiTags('Compute')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('compute')
export class ComputeController {
  constructor(
    private readonly jobs: AutotuneJobsService,
    private readonly settings: SettingsService,
  ) {}

  @Get('jobs')
  @ApiOperation({ summary: 'Все расчёты пользователя: идущие, очередь, пауза, завершённые' })
  list(@CurrentUser() user: User) {
    return this.jobs.list(user.id);
  }

  @Post('jobs/:jobId/pause')
  @ApiOperation({ summary: 'Пауза расчёта (уходит в конец очереди; начатые порции доработают)' })
  @ApiParam({ name: 'jobId' })
  pause(@CurrentUser() user: User, @Param('jobId') jobId: string) {
    return this.jobs.pause(user.id, jobId);
  }

  @Post('jobs/:jobId/resume')
  @ApiOperation({ summary: 'Снять расчёт с паузы (возвращается в очередь)' })
  @ApiParam({ name: 'jobId' })
  resume(@CurrentUser() user: User, @Param('jobId') jobId: string) {
    return this.jobs.resume(user.id, jobId);
  }

  @Get('config')
  @ApiOperation({ summary: 'Пул потоков сервера: всего/занято + длина очереди' })
  async config(@CurrentUser() user: User) {
    // После рестарта пул подхватывает сохранённое значение из настроек.
    const s = await this.settings.findByUser(user.id);
    this.jobs.seedTotalThreads(s.computeThreads);
    return this.jobs.getConfig();
  }

  @Patch('config')
  @ApiOperation({ summary: 'Сколько потоков сервера доступно расчётам (1–64)' })
  async updateConfig(@CurrentUser() user: User, @Body() dto: UpdateComputeConfigDto) {
    this.jobs.setTotalThreads(dto.totalThreads);
    // Персистим в настройках пользователя, чтобы пережить перезапуск сервера.
    await this.settings.update(user.id, { computeThreads: dto.totalThreads } as never);
    return this.jobs.getConfig();
  }
}
