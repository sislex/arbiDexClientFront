import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { ArbiConfigSource } from './arbi-config-source.entity';

@Entity('arbi_configs')
export class ArbiConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 255 })
  name: string;

  @Column()
  tradingSubscriptionId: string;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tradingSubscriptionId' })
  tradingSubscription: Subscription;

  @Column({ length: 20, default: 'USDC' })
  profitAsset: string;

  @Column('decimal', { precision: 5, scale: 4, default: 0.01 })
  slippage: number;

  @Column('decimal', { precision: 12, scale: 2, default: 100 })
  initialBalance: number;

  @OneToMany(() => ArbiConfigSource, (s) => s.config, {
    cascade: true,
    eager: true,
  })
  sources: ArbiConfigSource[];

  @CreateDateColumn()
  createdAt: Date;
}

