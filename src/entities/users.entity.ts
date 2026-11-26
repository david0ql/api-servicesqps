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
import type { ZoneFeatureCollection } from "../api/users/cleaner-zone.util";

/** longtext <-> objeto JSON (la geocerca puede pasar de los 64KB de `text`). */
const jsonLongtextTransformer = {
  to: (value: unknown) => (value === null || value === undefined ? null : JSON.stringify(value)),
  from: (value: string | null) => {
    if (value === null || value === undefined || value === '') return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  },
};

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

  @Column("tinyint", { name: "is_active", width: 1, default: () => "1" })
  isActive: boolean;

  // Zona de trabajo de la cleaner (rol 4). Se combinan: comunidades y/o
  // companias concretas, y/o poligonos libres (GeoJSON FeatureCollection,
  // coordenadas [lng, lat]). Ver api/users/cleaner-zone.util.ts.
  @Column("simple-json", { name: "work_community_ids", nullable: true, select: false })
  workCommunityIds: string[] | null;

  @Column("simple-json", { name: "work_company_ids", nullable: true, select: false })
  workCompanyIds: string[] | null;

  @Column("longtext", { name: "work_zones", nullable: true, select: false, transformer: jsonLongtextTransformer })
  workZones: ZoneFeatureCollection | null;

  // Derivado de los tres campos de arriba (se recalcula al guardar la zona).
  // Permite el filtro/badge "Sin zona" del listado sin leer los GeoJSON.
  @Column("boolean", { name: "has_work_zone", default: false })
  hasWorkZone: boolean;

  @OneToManyNoAction(() => CommunitiesEntity, (communitiesEntity) => communitiesEntity.supervisorUser)
  supervisedCommunities: CommunitiesEntity[];

  @OneToManyNoAction(() => CommunitiesEntity, (communitiesEntity) => communitiesEntity.managerUser)
  managedCommunities: CommunitiesEntity[];

  /** Complex que este vendedor asociado consiguio para QPS. */
  @OneToManyNoAction(() => CommunitiesEntity, (communitiesEntity) => communitiesEntity.vendorUser)
  vendorCommunities: CommunitiesEntity[];

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
