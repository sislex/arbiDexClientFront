import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ArbiConfig } from './arbi-config.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity('arbi_config_sources')
export class ArbiConfigSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  configId: string;

  @ManyToOne(() => ArbiConfig, (c) => c.sources, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'configId' })
  config: ArbiConfig;

  @Column()
  subscriptionId: string;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;
}

