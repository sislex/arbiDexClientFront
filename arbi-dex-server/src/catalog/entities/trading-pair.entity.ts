import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('trading_pairs')
export class TradingPair {
  @PrimaryColumn({ length: 100 })
  id: string;

  @Column({ length: 20 })
  base: string;

  @Column({ length: 20 })
  quote: string;

  @Column({ length: 50 })
  displayName: string;
}

