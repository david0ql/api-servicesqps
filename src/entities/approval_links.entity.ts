import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Enlace de aprobación enviado por SMS a cada super admin. Al abrirlo (sin
 * iniciar sesión) ve la solicitud y puede aprobarla o rechazarla. El token solo
 * se guarda como hash; es de un solo uso y no vence.
 */
@Index("idx_approval_links_token", ["tokenHash"], { unique: true })
@Index("idx_approval_links_change", ["pendingChangeId"])
@Entity("approval_links", { schema: "services_dbqa" })
export class ApprovalLinksEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("bigint", { name: "pending_change_id", unsigned: true })
  pendingChangeId: string;

  @Column("bigint", { name: "admin_user_id", unsigned: true })
  adminUserId: string;

  @Column("varchar", { name: "token_hash", length: 64 })
  tokenHash: string;

  /** null = no vence (por defecto). */
  @Column("timestamp", { name: "expires_at", nullable: true })
  expiresAt: Date | null;

  @Column("timestamp", { name: "used_at", nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;
}
