import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import type { StrategyConditionValue } from '../../demo/engine/types';

/** Strategy configuration: buy/sell condition sets with coefficients + tune ranges. */
@Entity('strategy_configs')
export class StrategyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  buy: StrategyConditionValue[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  sell: StrategyConditionValue[];

  @CreateDateColumn()
  createdAt: Date;
}
