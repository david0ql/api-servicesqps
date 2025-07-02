import {
  Column,
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ManyToOne, OneToMany } from "typeorm";

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

  @ManyToOne('ReviewClassesEntity', 'reviewItems')
  @JoinColumn([{ name: "review_class_id", referencedColumnName: "id" }])
  reviewClass: any;

  @OneToMany('ReviewsByServiceEntity', 'reviewItem')
  reviewsByServices: any[];
} 