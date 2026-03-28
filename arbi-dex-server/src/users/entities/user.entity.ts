import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { UserSettings } from '../../settings/entities/user-settings.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 42 })
  walletAddress: string;

  @Column({ nullable: true, length: 50 })
  walletProvider: string;

  @Column({ nullable: true })
  nonce: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Subscription, (sub) => sub.user, { cascade: true })
  subscriptions: Subscription[];

  @OneToOne(() => UserSettings, (settings) => settings.user, { cascade: true })
  settings: UserSettings;
}

