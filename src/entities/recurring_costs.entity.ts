import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { CostCategory, DEFAULT_COST_CATEGORY } from "src/constants/cost-categories";

@Entity("recurring_costs", { schema: "services_dbqa" })
export class RecurringCostsEntity {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id", unsigned: true })
  id: string;

  @Column("varchar", { name: "description", length: 191 })
  description: string;

  @Column("varchar", { name: "category", length: 40, default: DEFAULT_COST_CATEGORY })
  category: CostCategory;

  @Column("decimal", { name: "amount", precision: 10, scale: 2 })
  amount: string;

  @Column("date", { name: "start_date" })
  startDate: string;

  @Column("date", { name: "end_date", nullable: true })
  endDate: string | null;

  @Column("tinyint", { name: "is_active", width: 1, default: () => "1", transformer: { to: (v) => v, from: (v) => Boolean(v) } })
  isActive: boolean;

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
}
