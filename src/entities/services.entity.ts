import {
  Column,
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ExtrasByServiceEntity } from "./extras_by_service.entity";
import { ReviewsByServiceEntity } from "./reviews_by_service.entity";
import { ServiceChatMessagesEntity } from "./service_chat_messages.entity";
import { StatusesEntity } from "./statuses.entity";
import { CommunitiesEntity } from "./communities.entity";
import { UsersEntity } from "./users.entity";
import { TypesEntity } from "./types.entity";
import { ManyToOne, OneToMany } from "typeorm";

@Index("community_id", ["communityId"], {})
@Index("status_id", ["statusId"], {})
@Index("type_id", ["typeId"], {})
@Index("user_id", ["userId"], {})
@Index("recurring_service_id", ["recurringServiceId"], {})
@Entity("services", { schema: "services_dbqa" })
export class ServicesEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("date", { name: "date" })
  date: string;

  @Column("time", { name: "schedule", nullable: true })
  schedule: string | null;

  @Column("text", { name: "comment", nullable: true })
  comment: string | null;

  @Column("text", { name: "user_comment", nullable: true })
  userComment: string | null;

  @Column("varchar", { name: "unity_size", length: 191 })
  unitySize: string;

  @Column("varchar", { name: "unit_number", length: 191 })
  unitNumber: string;

  @Column("bigint", { name: "community_id", unsigned: true, nullable: true })
  communityId: string | null;

  @Column("bigint", { name: "type_id", unsigned: true, nullable: true })
  typeId: string | null;

  @Column("bigint", { name: "status_id", unsigned: true, nullable: true })
  statusId: string | null;

  @Column("bigint", { name: "user_id", nullable: true, unsigned: true })
  userId: string | null;

  @Column("bigint", { name: "recurring_service_id", nullable: true, unsigned: true })
  recurringServiceId: string | null;

  @Column("timestamp", { name: "started_at", nullable: true })
  startedAt: Date | null;

  @Column("decimal", { name: "start_latitude", precision: 10, scale: 7, nullable: true })
  startLatitude: string | null;

  @Column("decimal", { name: "start_longitude", precision: 10, scale: 7, nullable: true })
  startLongitude: string | null;

  @Column("decimal", { name: "start_accuracy", precision: 10, scale: 2, nullable: true })
  startAccuracy: string | null;

  @Column("decimal", { name: "start_altitude", precision: 10, scale: 2, nullable: true })
  startAltitude: string | null;

  @Column("decimal", { name: "start_altitude_accuracy", precision: 10, scale: 2, nullable: true })
  startAltitudeAccuracy: string | null;

  @Column("decimal", { name: "start_heading", precision: 10, scale: 2, nullable: true })
  startHeading: string | null;

  @Column("decimal", { name: "start_speed", precision: 10, scale: 2, nullable: true })
  startSpeed: string | null;

  @Column("text", { name: "start_location_meta", nullable: true })
  startLocationMeta: string | null;

  @Column("timestamp", { name: "finished_at", nullable: true })
  finishedAt: Date | null;

  @Column("decimal", { name: "finish_latitude", precision: 10, scale: 7, nullable: true })
  finishLatitude: string | null;

  @Column("decimal", { name: "finish_longitude", precision: 10, scale: 7, nullable: true })
  finishLongitude: string | null;

  @Column("decimal", { name: "finish_accuracy", precision: 10, scale: 2, nullable: true })
  finishAccuracy: string | null;

  @Column("decimal", { name: "finish_altitude", precision: 10, scale: 2, nullable: true })
  finishAltitude: string | null;

  @Column("decimal", { name: "finish_altitude_accuracy", precision: 10, scale: 2, nullable: true })
  finishAltitudeAccuracy: string | null;

  @Column("decimal", { name: "finish_heading", precision: 10, scale: 2, nullable: true })
  finishHeading: string | null;

  @Column("decimal", { name: "finish_speed", precision: 10, scale: 2, nullable: true })
  finishSpeed: string | null;

  @Column("text", { name: "finish_location_meta", nullable: true })
  finishLocationMeta: string | null;

  @Column("bigint", { name: "qa_user_id", unsigned: true, nullable: true })
  qaUserId: string | null;

  @Column("timestamp", { name: "qa_started_at", nullable: true })
  qaStartedAt: Date | null;

  @Column("decimal", { name: "qa_start_latitude", precision: 10, scale: 7, nullable: true })
  qaStartLatitude: string | null;

  @Column("decimal", { name: "qa_start_longitude", precision: 10, scale: 7, nullable: true })
  qaStartLongitude: string | null;

  @Column("decimal", { name: "qa_start_accuracy", precision: 10, scale: 2, nullable: true })
  qaStartAccuracy: string | null;

  @Column("decimal", { name: "qa_start_altitude", precision: 10, scale: 2, nullable: true })
  qaStartAltitude: string | null;

  @Column("decimal", { name: "qa_start_altitude_accuracy", precision: 10, scale: 2, nullable: true })
  qaStartAltitudeAccuracy: string | null;

  @Column("decimal", { name: "qa_start_heading", precision: 10, scale: 2, nullable: true })
  qaStartHeading: string | null;

  @Column("decimal", { name: "qa_start_speed", precision: 10, scale: 2, nullable: true })
  qaStartSpeed: string | null;

  @Column("text", { name: "qa_start_location_meta", nullable: true })
  qaStartLocationMeta: string | null;

  @Column("timestamp", { name: "qa_finished_at", nullable: true })
  qaFinishedAt: Date | null;

  @Column("decimal", { name: "qa_finish_latitude", precision: 10, scale: 7, nullable: true })
  qaFinishLatitude: string | null;

  @Column("decimal", { name: "qa_finish_longitude", precision: 10, scale: 7, nullable: true })
  qaFinishLongitude: string | null;

  @Column("decimal", { name: "qa_finish_accuracy", precision: 10, scale: 2, nullable: true })
  qaFinishAccuracy: string | null;

  @Column("decimal", { name: "qa_finish_altitude", precision: 10, scale: 2, nullable: true })
  qaFinishAltitude: string | null;

  @Column("decimal", { name: "qa_finish_altitude_accuracy", precision: 10, scale: 2, nullable: true })
  qaFinishAltitudeAccuracy: string | null;

  @Column("decimal", { name: "qa_finish_heading", precision: 10, scale: 2, nullable: true })
  qaFinishHeading: string | null;

  @Column("decimal", { name: "qa_finish_speed", precision: 10, scale: 2, nullable: true })
  qaFinishSpeed: string | null;

  @Column("text", { name: "qa_finish_location_meta", nullable: true })
  qaFinishLocationMeta: string | null;

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

  @OneToMany(
    () => ExtrasByServiceEntity,
    (extrasByServiceEntity) => extrasByServiceEntity.service
  )
  extrasByServices: ExtrasByServiceEntity[];

  @OneToMany('ReviewsByServiceEntity', 'service')
  reviewsByServices: any[];

  @OneToMany(
    () => ServiceChatMessagesEntity,
    (serviceChatMessagesEntity) => serviceChatMessagesEntity.service
  )
  chatMessages: ServiceChatMessagesEntity[];

  @ManyToOne(() => StatusesEntity, (statusesEntity) => statusesEntity.services)
  @JoinColumn([{ name: "status_id", referencedColumnName: "id" }])
  status: StatusesEntity | null;

  @ManyToOne(() => CommunitiesEntity, (communitiesEntity) => communitiesEntity.services)
  @JoinColumn([{ name: "community_id", referencedColumnName: "id" }])
  community: CommunitiesEntity | null;

  @ManyToOne(() => UsersEntity, (usersEntity) => usersEntity.services)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: UsersEntity | null;

  @ManyToOne(() => TypesEntity, (typesEntity) => typesEntity.services)
  @JoinColumn([{ name: "type_id", referencedColumnName: "id" }])
  type: TypesEntity | null;
}
