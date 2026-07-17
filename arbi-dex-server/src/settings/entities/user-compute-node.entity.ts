import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Дополнительный сервер расчётов: адрес такого же задеплоенного arbi-dex-server,
 * на который можно распределять параллельные прогоны (задел под distributed-режим;
 * пока узлы хранятся и показываются в меню настроек, расчёты идут локально).
 */
@Entity('user_compute_nodes')
export class UserComputeNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Название узла (для списка). */
  @Column({ length: 80, default: '' })
  name: string;

  /** Базовый URL сервера, напр. http://10.0.0.5:3006/api. */
  @Column({ length: 255 })
  baseUrl: string;

  /** Сколько потоков доступно на том сервере. */
  @Column({ type: 'int', default: 6 })
  threads: number;

  @Column({ default: true })
  enabled: boolean;
}
