import {
  Column,
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CommunitiesEntity } from "./communities.entity";
import { ServicesEntity } from "./services.entity";
import { ManyToOneNoAction, OneToManyNoAction } from "../decorators/relations.decorator";

@Index("community_id", ["communityId"], {})
@Entity("types", { schema: "services_dbqa" })
export class TypesEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("varchar", { name: "description", length: 191 })
  description: string;

  @Column("varchar", { name: "cleaning_type", length: 191 })
  cleaningType: string;

  @Column("double", { name: "price", precision: 8, scale: 2 })
  price: number;

  @Column("decimal", {
    name: "commission",
    precision: 8,
    scale: 2,
    default: () => 0,
  })
  commission: number;

  @Column("boolean", { name: "show_in_mobile", default: true })
  showInMobile: boolean;

  @Column("bigint", {
    name: "community_id",
    unsigned: true,
    nullable: true,
  })
  communityId: string | null;

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

  @OneToManyNoAction(() => ServicesEntity, (servicesEntity) => servicesEntity.type)
  services: ServicesEntity[];

  @ManyToOneNoAction(() => CommunitiesEntity, (communitiesEntity) => communitiesEntity.types)
  @JoinColumn([{ name: "community_id", referencedColumnName: "id" }])
  community: CommunitiesEntity | null;
}
