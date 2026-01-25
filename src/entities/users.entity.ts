import {
  Column,
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CommunitiesEntity } from "./communities.entity";
import { ServicesEntity } from "./services.entity";
import { RolesEntity } from "./roles.entity";
import { ServiceChatMessagesEntity } from "./service_chat_messages.entity";
import { ManyToOneNoAction, OneToManyNoAction } from "../decorators/relations.decorator";

@Index("role_id", ["roleId"], {})
@Entity("users", { schema: "services_dbqa" })
export class UsersEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("varchar", { name: "name", length: 45 })
  name: string;

  @Column("varchar", { name: "email", length: 75 })
  email: string;

  @Column("varchar", { name: "phone_number", nullable: true, length: 25 })
  phoneNumber: string | null;

  @Column("bigint", {
    name: "role_id",
    unsigned: true,
    nullable: true,
  })
  roleId: string | null;

  @Column("varchar", { name: "password", length: 255 })
  password: string;

  @Column("varchar", { name: "token", length: 255, default: '' })
  token: string;

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

  @OneToManyNoAction(() => CommunitiesEntity, (communitiesEntity) => communitiesEntity.supervisorUser)
  supervisedCommunities: CommunitiesEntity[];

  @OneToManyNoAction(() => CommunitiesEntity, (communitiesEntity) => communitiesEntity.managerUser)
  managedCommunities: CommunitiesEntity[];

  @OneToManyNoAction(() => ServicesEntity, (servicesEntity) => servicesEntity.user)
  services: ServicesEntity[];

  @OneToManyNoAction(
    () => ServiceChatMessagesEntity,
    (serviceChatMessagesEntity) => serviceChatMessagesEntity.user
  )
  chatMessages: ServiceChatMessagesEntity[];

  @ManyToOneNoAction(() => RolesEntity, (rolesEntity) => rolesEntity.users)
  @JoinColumn([{ name: "role_id", referencedColumnName: "id" }])
  role: RolesEntity | null;
}
