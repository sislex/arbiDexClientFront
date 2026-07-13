import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Market configuration for the new frontend: a trading market plus observed
 * (reference) markets whose weighted average is the "fair" price. */
@Entity('market_configs')
export class MarketConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 255 })
  name: string;

  /** Market id we trade on (usually a DEX). Nullable while drafting. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  tradingMarketId: string | null;

  /** Observed reference market ids (usually CEXes). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  observedMarketIds: string[];

  @Column({ default: true })
  useWeightedAverage: boolean;

  /** Optional per-market weight; equal weight when absent. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  weights: Record<string, number>;

  @CreateDateColumn()
  createdAt: Date;
}
