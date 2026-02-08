import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'cleaner_report_links' })
export class CleanerReportLinksEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Index()
  @Column('bigint', { name: 'user_id', unsigned: true })
  userId: string;

  @Column('date', { name: 'start_date' })
  startDate: string;

  @Column('date', { name: 'end_date' })
  endDate: string;

  @Index()
  @Column('datetime', { name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
