import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('sources')
export class Source {
  @PrimaryColumn({ length: 100 })
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  displayName: string;

  @Column({ length: 10 })
  type: string; // 'dex' | 'cex'

  @Column({ nullable: true, length: 200 })
  icon: string;

  @Column({ default: true })
  isActive: boolean;
}

