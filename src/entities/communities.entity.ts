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

  // Permite sacar un complex de los selectores de creacion sin borrar su
  // historia: los servicios pasados siguen contando en calendario y reportes.
  @Column("boolean", { name: "is_active", default: true })
  isActive: boolean;

  // Vendedor asociado que consiguio el complex. Cobra una comision sobre lo
  // que ese complex deja despues de pagarle a las cleaners.
  @Column("bigint", { name: "vendor_user_id", unsigned: true, nullable: true })
  vendorUserId: string | null;

  // Desde cuando aplica la comision. Felix lo definio asi: "aplican desde que
  // creen una comunidad que haya traido el broker", o sea que los reportes de
  // semanas anteriores a esta fecha salen sin comision.
  @Column("date", { name: "vendor_assigned_at", nullable: true })
  vendorAssignedAt: string | null;

  // Porcentaje pactado. 10% por defecto, configurable por si a futuro se
  // acuerda distinto con algun vendedor.
  @Column("decimal", { name: "vendor_commission_rate", precision: 5, scale: 4, nullable: true })
  vendorCommissionRate: string | null;

  // Ubicacion del complex. Se manda como link de mapa en el SMS al cleaner
  // cuando acepta el servicio. Misma precision que el tracking de servicios.
  @Column("decimal", { name: "latitude", precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column("decimal", { name: "longitude", precision: 10, scale: 7, nullable: true })
  longitude: string | null;

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

  @ManyToOneNoAction(() => UsersEntity, (usersEntity) => usersEntity.vendorCommunities)
  @JoinColumn([{ name: "vendor_user_id", referencedColumnName: "id" }])
  vendorUser: UsersEntity | null;

  @OneToManyNoAction(() => ServicesEntity, (servicesEntity) => servicesEntity.community)
  services: ServicesEntity[];

  @OneToManyNoAction(() => TypesEntity, (typesEntity) => typesEntity.community)
  types: TypesEntity[];
}
