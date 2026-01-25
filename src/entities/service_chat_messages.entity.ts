import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { ServicesEntity } from "./services.entity";
import { UsersEntity } from "./users.entity";

@Index("service_id", ["serviceId"], {})
@Index("user_id", ["userId"], {})
@Entity("service_chat_messages", { schema: "services_dbqa" })
export class ServiceChatMessagesEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("bigint", { name: "service_id", unsigned: true })
  serviceId: string;

  @Column("bigint", { name: "user_id", unsigned: true, nullable: true })
  userId: string | null;

  @Column("text", { name: "message", nullable: true })
  message: string | null;

  @Column("varchar", { name: "attachment_path", length: 512, nullable: true })
  attachmentPath: string | null;

  @Column("varchar", { name: "attachment_type", length: 12, nullable: true })
  attachmentType: string | null;

  @Column("varchar", { name: "attachment_mime", length: 120, nullable: true })
  attachmentMime: string | null;

  @Column("varchar", { name: "attachment_name", length: 255, nullable: true })
  attachmentName: string | null;

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

  @ManyToOne(() => ServicesEntity, (servicesEntity) => servicesEntity.chatMessages, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "service_id", referencedColumnName: "id" }])
  service: ServicesEntity | null;

  @ManyToOne(() => UsersEntity, (usersEntity) => usersEntity.chatMessages, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: UsersEntity | null;
}
