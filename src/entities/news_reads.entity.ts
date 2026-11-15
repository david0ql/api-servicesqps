import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/** Registro de que un usuario acepto (leyo) una noticia. Un registro por par noticia-usuario. */
@Index("news_reads_news_user", ["newsId", "userId"], { unique: true })
@Index("news_reads_user", ["userId"], {})
@Entity("news_reads", { schema: "services_dbqa" })
export class NewsReadsEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("bigint", { name: "news_id", unsigned: true })
  newsId: string;

  @Column("bigint", { name: "user_id", unsigned: true })
  userId: string;

  @Column("timestamp", {
    name: "accepted_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  acceptedAt: Date;
}
