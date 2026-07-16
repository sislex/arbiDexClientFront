import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type TradingContractKind = 'quoter' | 'executor';

/**
 * Пользовательский квотер- или executor-контракт: сеть + RPC URL + адрес.
 * Записей может быть сколько угодно (добавляются в меню настроек); торговля
 * использует активную запись сети (`isActive`), а при её отсутствии —
 * серверный .env (<PREFIX>_QUOTER_ADDRESS / <PREFIX>_EXECUTOR_ADDRESS).
 */
@Entity('user_trading_contracts')
export class UserTradingContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 10 })
  kind: TradingContractKind;

  /** Префикс сети: ARBITRUM | OPTIMISM | BASE. */
  @Column({ length: 20 })
  network: string;

  /** Человекочитаемое название записи (не обязательно). */
  @Column({ length: 80, default: '' })
  name: string;

  @Column({ length: 255, default: '' })
  rpcUrl: string;

  @Column({ length: 64 })
  address: string;

  /** Активная запись сети — именно её использует торговля. */
  @Column({ default: false })
  isActive: boolean;
}
