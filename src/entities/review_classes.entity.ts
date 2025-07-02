import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from "typeorm";

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

  @OneToMany('ReviewItemsEntity', 'reviewClass')
  reviewItems: any[];
} 