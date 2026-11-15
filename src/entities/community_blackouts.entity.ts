import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CommunitiesEntity } from "./communities.entity";

/** Tipo de bloqueo:
 *  - full_day: el dia completo.
 *  - am: la manana, 00:00 a 12:00.
 *  - pm: la tarde, 12:00 a 24:00.
 *  - custom: el rango [startTime, endTime) que se indique. */
export type BlackoutPeriod = "full_day" | "am" | "pm" | "custom";

/** Dias (o franjas) en los que una comunidad no recibe servicios, por ejemplo
 *  por festividades (Thanksgiving, Navidad...). Un registro cubre una fecha o
 *  un rango de fechas [startDate, endDate]; la franja horaria aplica a cada
 *  dia del rango. */
@Index("community_blackouts_community_id", ["communityId"], {})
@Index("community_blackouts_dates", ["startDate", "endDate"], {})
@Entity("community_blackouts", { schema: "services_dbqa" })
export class CommunityBlackoutsEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("bigint", { name: "community_id", unsigned: true })
  communityId: string;

  @Column("date", { name: "start_date" })
  startDate: string;

  @Column("date", { name: "end_date" })
  endDate: string;

  @Column("varchar", { name: "period", length: 16, default: "full_day" })
  period: BlackoutPeriod;

  // Solo para period = custom (HH:mm:ss). end_time puede ser 24:00:00.
  @Column("time", { name: "start_time", nullable: true })
  startTime: string | null;

  @Column("time", { name: "end_time", nullable: true })
  endTime: string | null;

  @Column("varchar", { name: "reason", length: 120, nullable: true })
  reason: string | null;

  @Column("bigint", { name: "created_by_user_id", unsigned: true, nullable: true })
  createdByUserId: string | null;

  @Column("timestamp", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @ManyToOne(() => CommunitiesEntity, { onDelete: "CASCADE", onUpdate: "CASCADE" })
  @JoinColumn([{ name: "community_id", referencedColumnName: "id" }])
  community: CommunitiesEntity;
}
