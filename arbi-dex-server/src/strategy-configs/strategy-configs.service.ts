import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrategyConfig } from './entities/strategy-config.entity';
import { CreateStrategyConfigDto, UpdateStrategyConfigDto } from './dto/strategy-config.dto';
import { defaultStrategySides } from '../demo/engine/conditions-catalog';

@Injectable()
export class StrategyConfigsService {
  constructor(
    @InjectRepository(StrategyConfig)
    private readonly repo: Repository<StrategyConfig>,
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
    return this.repo.save(s);
  }

  async remove(userId: string, id: string): Promise<void> {
    const s = await this.findOne(userId, id);
    await this.repo.remove(s);
  }

  /** Default buy/sell sides derived from the conditions catalog. */
  defaults() {
    return defaultStrategySides();
  }
}
