import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { OneToManyNoAction } from "../decorators/relations.decorator";

@Entity("review_classes", { schema: "services_dbqa" })
export class ReviewClassesEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("varchar", { name: "name", length: 255 })
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

  @OneToManyNoAction(() => () => import("./review_items.entity").then(m => m.ReviewItemsEntity), (reviewItemsEntity: any) => reviewItemsEntity.reviewClass)
  reviewItems: any[];
} 