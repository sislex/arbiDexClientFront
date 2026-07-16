import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Пользовательское сопоставление токенов: сеть + адрес контракта + название
 * (символ) + decimals. Используется торговлей ботов для резолва адресов пары;
 * дополняет встроенный каталог Arbitrum-токенов.
 */
@Entity('user_tokens')
@Unique(['userId', 'network', 'address'])
export class UserToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Префикс сети: ARBITRUM | OPTIMISM | BASE. */
  @Column({ length: 20 })
  network: string;

  /** Адрес контракта токена (lowercase). */
  @Column({ length: 64 })
  address: string;

  /** Название/символ токена (WETH, USDC, …). */
  @Column({ length: 40 })
  symbol: string;

  @Column({ type: 'int', default: 18 })
  decimals: number;
}
