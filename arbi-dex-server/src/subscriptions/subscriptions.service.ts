import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly repo: Repository<Subscription>,
  ) {}

  findAll(userId: string): Promise<Subscription[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  create(userId: string, dto: CreateSubscriptionDto): Promise<Subscription> {
    const sub = this.repo.create({ userId, ...dto, enabled: true });
    return this.repo.save(sub);
  }

  async toggle(userId: string, id: string): Promise<Subscription> {
    const sub = await this.repo.findOne({ where: { id, userId } });
    if (!sub) throw new NotFoundException('Подписка не найдена');
    sub.enabled = !sub.enabled;
    return this.repo.save(sub);
  }

  async remove(userId: string, id: string): Promise<void> {
    const sub = await this.repo.findOne({ where: { id, userId } });
    if (!sub) throw new NotFoundException('Подписка не найдена');
    await this.repo.remove(sub);
  }
}

