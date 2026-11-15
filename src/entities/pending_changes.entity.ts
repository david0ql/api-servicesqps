import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UsersEntity } from "./users.entity";

export type PendingChangeStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed'
  | 'expired';

export type PendingChangeDecisionChannel = 'sms' | 'web' | 'link';

/**
 * Solicitud de cambio hecha por un usuario Admin Papel (rol 9). La petición
 * HTTP original (método, url, body) se guarda tal cual y se re-ejecuta contra
 * el propio API cuando un super admin la aprueba.
 */
@Index("idx_pending_changes_code_status", ["code", "status"])
@Index("idx_pending_changes_user", ["userId"])
@Entity("pending_changes", { schema: "services_dbqa" })
export class PendingChangesEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  /** Código corto (letra + número, ej. A12) único entre las pendientes. */
  @Column("varchar", { name: "code", length: 8 })
  code: string;

  @Column("varchar", { name: "method", length: 10 })
  method: string;

  /** Path + query string tal como llegó (req.originalUrl). */
  @Column("varchar", { name: "url", length: 1000 })
  url: string;

  @Column("json", { name: "body", nullable: true })
  body: unknown;

  @Column("bigint", { name: "user_id", unsigned: true })
  userId: string;

  @Column("varchar", { name: "summary", length: 500 })
  summary: string;

  @Column("varchar", { name: "status", length: 12, default: 'pending' })
  status: PendingChangeStatus;

  @Column("bigint", { name: "decided_by_user_id", unsigned: true, nullable: true })
  decidedByUserId: string | null;

  @Column("varchar", { name: "decision_channel", length: 5, nullable: true })
  decisionChannel: PendingChangeDecisionChannel | null;

  /** Último reenvío del SMS a los admins (botón "Reenviar SMS" del Admin Papel). */
  @Column("timestamp", { name: "last_reminded_at", nullable: true })
  lastRemindedAt: Date | null;

  @Column("int", { name: "remind_count", default: 0 })
  remindCount: number;

  @Column("text", { name: "comment", nullable: true })
  comment: string | null;

  @Column("timestamp", { name: "decided_at", nullable: true })
  decidedAt: Date | null;

  /** sha256 del token de un solo uso que autoriza la re-ejecución. Nunca se
   *  guarda el token en claro. */
  @Column("varchar", { name: "approval_token_hash", length: 64, nullable: true, select: false })
  approvalTokenHash: string | null;

  @Column("timestamp", { name: "token_consumed_at", nullable: true })
  tokenConsumedAt: Date | null;

  @Column("int", { name: "result_status", nullable: true })
  resultStatus: number | null;

  @Column("mediumtext", { name: "result_body", nullable: true })
  resultBody: string | null;

  @Column("text", { name: "error", nullable: true })
  error: string | null;

  @Column("timestamp", { name: "executed_at", nullable: true })
  executedAt: Date | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;

  // Sin FK física: el historial de solicitudes no debe bloquear borrar usuarios.
  @ManyToOne(() => UsersEntity, { createForeignKeyConstraints: false })
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: UsersEntity;

  @ManyToOne(() => UsersEntity, { createForeignKeyConstraints: false, nullable: true })
  @JoinColumn([{ name: "decided_by_user_id", referencedColumnName: "id" }])
  decidedByUser: UsersEntity | null;
}
