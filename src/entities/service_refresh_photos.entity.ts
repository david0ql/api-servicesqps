import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Fotos que la QA manda al pedir un refresh (metodologia nueva: ya no hay
 * checklist, solo fotos de lo que quedo mal). Cada envio de refresh es una
 * "ronda" (round) por servicio: 1, 2, 3... Las fotos se guardan en
 * uploads/service-refresh y se sirven estaticas por /uploads (main.ts).
 */
@Index("service_refresh_photos_service_round", ["serviceId", "round"], {})
@Entity("service_refresh_photos", { schema: "services_dbqa" })
export class ServiceRefreshPhotosEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("bigint", { name: "service_id", unsigned: true })
  serviceId: string;

  @Column("int", { name: "round", default: () => "1" })
  round: number;

  @Column("varchar", { name: "photo_path", length: 512 })
  photoPath: string;

  @Column("bigint", { name: "created_by_user_id", unsigned: true, nullable: true })
  createdByUserId: string | null;

  @Column("text", { name: "message", nullable: true })
  message: string | null;

  @Column("timestamp", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  // Al borrar el servicio se borran sus fotos (la tabla es nueva, el FK no
  // afecta datos existentes).
  @ManyToOne('ServicesEntity', { onDelete: 'CASCADE' })
  @JoinColumn([{ name: "service_id", referencedColumnName: "id" }])
  service: any;
}
