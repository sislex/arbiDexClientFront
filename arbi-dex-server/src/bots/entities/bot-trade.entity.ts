import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Bot } from './bot.entity';
import type { Side } from '../../demo/engine/types';

export type BotTradeStatus = 'success' | 'failed';
export type BotTradeMode = 'demo' | 'real';

/**
 * One manual live trade of a bot (buy/sell button on the live tab), both
 * executed and failed — failed ones are kept to show on the chart. Demo trades
 * are quoted through the executor contract (`executeSwaps.staticCall`), real
 * ones are executed on-chain through it.
 */
@Entity('bot_trades')
export class BotTrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  botId: string;

  @ManyToOne(() => Bot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot: Bot;

  @Column()
  userId: string;

  /** Trade time, unix ms. */
  @Column({ type: 'double precision' })
  time: number;

  @Column({ type: 'varchar', length: 4 })
  side: Side;

  @Column({ type: 'varchar', length: 10 })
  status: BotTradeStatus;

  @Column({ type: 'varchar', length: 10 })
  mode: BotTradeMode;

  /** Executed (quoted) price, quote per base; null when quoting itself failed. */
  @Column({ type: 'double precision', nullable: true })
  price: number | null;

  /** The quote the user saw when clicking — the slippage baseline. */
  @Column({ type: 'double precision', nullable: true })
  expectedPrice: number | null;

  /** Amount in: quote asset for buys, base asset for sells. */
  @Column({ type: 'double precision', default: 0 })
  amountIn: number;

  /** Amount out of the swap (base for buys, quote for sells). */
  @Column({ type: 'double precision', nullable: true })
  amountOut: number | null;

  /** Realised PnL in the quote asset (successful sells only). */
  @Column({ type: 'double precision', nullable: true })
  pnl: number | null;

  /** Failure reason (slippage exceeded / execution error). */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'varchar', length: 80, default: '' })
  txHash: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  txUrl: string;

  /**
   * Разбор шага, на котором движок принял решение (processStep: сигналы +
   * условия по сторонам) — «из истории», как записи шагов в бэктесте.
   * null у ручных сделок кнопками и у сделок до появления поля.
   */
  @Column({ type: 'jsonb', nullable: true })
  stepResult: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
