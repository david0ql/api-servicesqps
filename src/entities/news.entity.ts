import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Noticia del portal "Last News" que se muestra dentro de la app movil.
 * `audienceRoles` null = todos los usuarios de la app; si trae ids de rol,
 * solo esos roles la ven.
 */
@Index("news_published", ["isPublished", "publishedAt"], {})
@Entity("news", { schema: "services_dbqa" })
export class NewsEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("varchar", { name: "title", length: 180 })
  title: string;

  @Column("text", { name: "body" })
  body: string;

  @Column("varchar", { name: "image_url", length: 512, nullable: true })
  imageUrl: string | null;

  @Column("simple-json", { name: "audience_roles", nullable: true })
  audienceRoles: string[] | null;

  @Column("tinyint", { name: "is_published", width: 1, default: () => "0" })
  isPublished: boolean;

  @Column("timestamp", { name: "published_at", nullable: true })
  publishedAt: Date | null;

  @Column("bigint", { name: "created_by_user_id", unsigned: true, nullable: true })
  createdByUserId: string | null;

  @Column("timestamp", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp", {
    name: "updated_at",
    default: () => "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  })
  updatedAt: Date;
}
