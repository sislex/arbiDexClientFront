import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrategyConfig } from './entities/strategy-config.entity';
import { CreateStrategyConfigDto, UpdateStrategyConfigDto } from './dto/strategy-config.dto';
import { defaultStrategySides } from '../demo/engine/conditions-catalog';
import { Bot } from '../bots/entities/bot.entity';
import { BotSession } from '../bots/entities/bot-session.entity';

@Injectable()
export class StrategyConfigsService {
  constructor(
    @InjectRepository(StrategyConfig)
    private readonly repo: Repository<StrategyConfig>,
    @InjectRepository(Bot)
    private readonly botsRepo: Repository<Bot>,
    @InjectRepository(BotSession)
    private readonly sessionsRepo: Repository<BotSession>,
  ) {}

  findAll(userId: string): Promise<StrategyConfig[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findOne(userId: string, id: string): Promise<StrategyConfig> {
    const s = await this.repo.findOne({ where: { id, userId } });
    if (!s) throw new NotFoundException('Стратегия не найдена');
    return s;
  }

  create(userId: string, dto: CreateStrategyConfigDto): Promise<StrategyConfig> {
    const s = this.repo.create({ userId, name: dto.name, buy: dto.buy, sell: dto.sell });
    return this.repo.save(s);
  }

  async update(userId: string, id: string, dto: UpdateStrategyConfigDto): Promise<StrategyConfig> {
    const s = await this.findOne(userId, id);
    Object.assign(s, dto);
    const saved = await this.repo.save(s);
    // Смена стратегии: закрыть сессию и остановить бота (запуск вручную).
    await this.stopLinkedBotSessions(id);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const s = await this.findOne(userId, id);
    await this.repo.remove(s);
  }

  /** Default buy/sell sides derived from the conditions catalog. */
  defaults() {
    return defaultStrategySides();
  }

  /** Закрыть сессии и остановить ботов на этой стратегии — без автозапуска. */
  private async stopLinkedBotSessions(strategyConfigId: string): Promise<void> {
    const bots = await this.botsRepo.find({ where: { strategyConfigId } });
    if (bots.length === 0) return;
    const at = Date.now();
    const ids = bots.map((b) => b.id);

    await this.sessionsRepo
      .createQueryBuilder()
      .update(BotSession)
      .set({ endedAt: at })
      .where('botId IN (:...ids)', { ids })
      .andWhere('endedAt = 0')
      .execute();

    const toStop = bots.filter((b) => b.status === 'running' || b.status === 'paused').map((b) => b.id);
    if (toStop.length > 0) {
      await this.botsRepo
        .createQueryBuilder()
        .update(Bot)
        .set({ status: 'stopped' })
        .where('id IN (:...ids)', { ids: toStop })
        .execute();
    }
  }
}
