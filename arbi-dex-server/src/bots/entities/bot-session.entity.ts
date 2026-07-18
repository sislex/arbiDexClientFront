import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Торговая сессия бота: создаётся при запуске (status → running), закрывается
 * при остановке. Сделки сессии выбираются из журнала по окну времени
 * [startedAt, endedAt) — отдельной связи в bot_trades нет.
 */
@Entity('bot_sessions')
export class BotSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Index()
  @Column({ type: 'uuid' })
  botId: string;

  /** Начало сессии, unix ms. */
  @Column({ type: 'double precision' })
  startedAt: number;

  /** Конец сессии, unix ms; 0 — сессия активна. */
  @Column({ type: 'double precision', default: 0 })
  endedAt: number;

  /** Свободный баланс бота на старте сессии (в валюте баланса). */
  @Column({ type: 'double precision', default: 0 })
  startBalance: number;

  /** Режим бота на старте (demo-live / real-live). */
  @Column({ length: 20, default: '' })
  mode: string;

  @CreateDateColumn()
  createdAt: Date;
}
