import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CommunitiesEntity } from "./communities.entity";
import { StatusesEntity } from "./statuses.entity";
import { TypesEntity } from "./types.entity";
import { UsersEntity } from "./users.entity";

@Index("recurring_services_community_id", ["communityId"], {})
@Index("recurring_services_type_id", ["typeId"], {})
@Index("recurring_services_status_id", ["statusId"], {})
@Index("recurring_services_user_id", ["userId"], {})
@Entity("recurring_services", { schema: "services_dbqa" })
export class RecurringServicesEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("bigint", { name: "community_id", unsigned: true, nullable: true })
  communityId: string | null;

  @Column("bigint", { name: "type_id", unsigned: true, nullable: true })
  typeId: string | null;

  @Column("bigint", { name: "status_id", unsigned: true, nullable: true })
  statusId: string | null;

  @Column("bigint", { name: "user_id", unsigned: true, nullable: true })
  userId: string | null;

  @Column("varchar", { name: "unity_size", length: 191 })
  unitySize: string;

  @Column("varchar", { name: "unit_number", length: 191 })
  unitNumber: string;

  @Column("time", { name: "schedule", nullable: true })
  schedule: string | null;

  @Column("text", { name: "comment", nullable: true })
  comment: string | null;

  @Column("text", { name: "user_comment", nullable: true })
  userComment: string | null;

  @Column("simple-array", { name: "days_of_week" })
  daysOfWeek: string[];

  @Column("simple-array", { name: "extra_ids", nullable: true })
  extraIds: string[] | null;

  @Column("date", { name: "start_date" })
  startDate: string;

  @Column("tinyint", { name: "is_active", width: 1, default: () => "1" })
  isActive: boolean;

  @Column("timestamp", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp", {
    name: "updated_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date;

  @ManyToOne(() => CommunitiesEntity)
  @JoinColumn([{ name: "community_id", referencedColumnName: "id" }])
  community: CommunitiesEntity | null;

  @ManyToOne(() => TypesEntity)
  @JoinColumn([{ name: "type_id", referencedColumnName: "id" }])
  type: TypesEntity | null;

  @ManyToOne(() => StatusesEntity)
  @JoinColumn([{ name: "status_id", referencedColumnName: "id" }])
  status: StatusesEntity | null;

  @ManyToOne(() => UsersEntity)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: UsersEntity | null;
}
