import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import type { BotStatus, TradingMode } from '../../demo/engine/types';

/** A bot links a market config to a strategy config and holds the demo account
 * (balance / PnL / stats), updated by demo backtests. */
@Entity('bots')
export class Bot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'stopped' })
  status: BotStatus;

  @Column({ type: 'varchar', length: 20, default: 'idle' })
  mode: TradingMode;

  @Column({ type: 'uuid' })
  marketConfigId: string;

  @Column({ type: 'uuid' })
  strategyConfigId: string;

  @Column({ length: 20, default: 'WETH' })
  baseAsset: string;

  @Column({ length: 20, default: 'USDC' })
  quoteAsset: string;

  // double precision → returned as JS numbers (not decimal strings).
  @Column({ type: 'double precision', default: 1000 })
  initialBalance: number;

  @Column({ type: 'double precision', default: 1000 })
  balance: number;

  @Column({ type: 'double precision', default: 0 })
  pnl: number;

  @Column({ type: 'double precision', default: 0 })
  pnlPct: number;

  @Column({ type: 'int', default: 0 })
  tradesCount: number;

  @Column({ type: 'double precision', default: 0 })
  winRate: number;

  @Column({ default: false })
  openPosition: boolean;

  /** Allowed slippage for live buy/sell, % (quote moved further → trade fails). */
  @Column({ type: 'double precision', default: 0.5 })
  slippagePct: number;

  /** Open position size in the base asset (manual live trading). */
  @Column({ type: 'double precision', default: 0 })
  positionSize: number;

  /** Entry price of the open position (quote per base). */
  @Column({ type: 'double precision', default: 0 })
  entryPrice: number;

  /** When the open position was entered, unix ms (for sell triggers). */
  @Column({ type: 'double precision', default: 0 })
  positionOpenedAt: number;

  /** When the bot was switched to `running`, unix ms (live chart starts here). */
  @Column({ type: 'double precision', default: 0 })
  startedAt: number;

  /** Last time the live engine evaluated this bot, unix ms (liveness). */
  @Column({ type: 'double precision', default: 0 })
  lastTickAt: number;

  /** Last time the strategy produced a buy/sell signal, unix ms. */
  @Column({ type: 'double precision', default: 0 })
  lastSignalAt: number;

  /** Until when the bot pauses after a failed trade, unix ms. */
  @Column({ type: 'double precision', default: 0 })
  failCooldownUntil: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
