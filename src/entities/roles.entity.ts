import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UsersEntity } from "./users.entity";
import { PermissionsByRoleEntity } from "./permissions_by_role";
import { OneToManyNoAction } from "../decorators/relations.decorator";

@Entity("roles", { schema: "services_dbqa" })
export class RolesEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("varchar", { name: "name", length: 25 })
  name: string;

  @Column("timestamp", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp", {
    name: "updated_at",
    default: () => "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  })
  updatedAt: Date;

  @OneToManyNoAction(() => PermissionsByRoleEntity, (permissionsByRole) => permissionsByRole.role)
  permissionsByRole: PermissionsByRoleEntity[];

  @OneToManyNoAction(() => UsersEntity, (usersEntity) => usersEntity.role)
  users: UsersEntity[];
}
