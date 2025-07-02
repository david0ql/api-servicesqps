import {
  Column,
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ReviewClassesEntity } from "./review_classes.entity";
import { ManyToOneNoAction, OneToManyNoAction } from "../decorators/relations.decorator";

@Index("review_class_id", ["reviewClassId"], {})
@Entity("review_items", { schema: "services_dbqa" })
export class ReviewItemsEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("bigint", { name: "review_class_id", unsigned: true })
  reviewClassId: string;

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

  @ManyToOneNoAction(() => ReviewClassesEntity, (reviewClassesEntity) => reviewClassesEntity.reviewItems)
  @JoinColumn([{ name: "review_class_id", referencedColumnName: "id" }])
  reviewClass: ReviewClassesEntity;

  @OneToManyNoAction(() => () => import("./reviews_by_service.entity").then(m => m.ReviewsByServiceEntity), (reviewsByServiceEntity: any) => reviewsByServiceEntity.reviewItem)
  reviewsByServices: any[];
} 