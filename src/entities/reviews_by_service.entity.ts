import {
  Column,
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ManyToOne } from "typeorm";

@Index("service_id", ["serviceId"], {})
@Index("review_item_id", ["reviewItemId"], {})
@Entity("reviews_by_service", { schema: "services_dbqa" })
export class ReviewsByServiceEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("bigint", { name: "service_id", unsigned: true })
  serviceId: string;

  @Column("bigint", { name: "review_item_id", unsigned: true })
  reviewItemId: string;

  @Column("int", { name: "value" })
  value: number;

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

  @ManyToOne('ServicesEntity', 'reviewsByServices')
  @JoinColumn([{ name: "service_id", referencedColumnName: "id" }])
  service: any;

  @ManyToOne('ReviewItemsEntity', 'reviewsByServices')
  @JoinColumn([{ name: "review_item_id", referencedColumnName: "id" }])
  reviewItem: any;
} 