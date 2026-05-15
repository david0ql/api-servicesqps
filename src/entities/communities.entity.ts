import {
  Column,
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CompaniesEntity } from "./companies.entity";
import { ServicesEntity } from "./services.entity";
import { TypesEntity } from "./types.entity";
import { UsersEntity } from "./users.entity";
import { ManyToOneNoAction, OneToManyNoAction } from "../decorators/relations.decorator";

@Index("company_id", ["companyId"], {})
@Index("supervisor_user_id", ["supervisorUserId"], {})
@Index("manager_user_id", ["managerUserId"], {})
@Entity("communities", { schema: "services_dbqa" })
export class CommunitiesEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("varchar", { name: "community_name", length: 80 })
  communityName: string;

  @Column("boolean", { name: "show_in_reports", default: true })
  showInReports: boolean;

  @Column("bigint", {
    name: "supervisor_user_id",
    unsigned: true,
    nullable: true,
  })
  supervisorUserId: string | null;

  @Column("bigint", {
    name: "manager_user_id",
    unsigned: true,
    nullable: true,
  })
  managerUserId: string | null;

  @Column("bigint", {
    name: "company_id",
    unsigned: true,
    nullable: true,
  })
  companyId: string | null;

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

  @ManyToOneNoAction(() => CompaniesEntity, (companiesEntity) => companiesEntity.communities)
  @JoinColumn([{ name: "company_id", referencedColumnName: "id" }])
  company: CompaniesEntity | null;

  @ManyToOneNoAction(() => UsersEntity, (usersEntity) => usersEntity.supervisedCommunities)
  @JoinColumn([{ name: "supervisor_user_id", referencedColumnName: "id" }])
  supervisorUser: UsersEntity | null;

  @ManyToOneNoAction(() => UsersEntity, (usersEntity) => usersEntity.managedCommunities)
  @JoinColumn([{ name: "manager_user_id", referencedColumnName: "id" }])
  managerUser: UsersEntity | null;

  @OneToManyNoAction(() => ServicesEntity, (servicesEntity) => servicesEntity.community)
  services: ServicesEntity[];

  @OneToManyNoAction(() => TypesEntity, (typesEntity) => typesEntity.community)
  types: TypesEntity[];
}
