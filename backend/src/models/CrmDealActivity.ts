import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  AllowNull,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import CrmDeal from "./CrmDeal";
import User from "./User";

export type CrmDealActivityType =
  | "created"
  | "updated"
  | "stage_changed"
  | "priority_changed"
  | "follow_up_set"
  | "follow_up_cleared"
  | "attention_marked"
  | "attention_resolved"
  | "comment"
  | "automation_triggered"
  | "custom_fields_updated";

@Table({ tableName: "CrmDealActivities" })
class CrmDealActivity extends Model<CrmDealActivity> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => CrmDeal)
  @Column
  dealId: number;

  @BelongsTo(() => CrmDeal)
  deal: CrmDeal;

  @AllowNull
  @ForeignKey(() => User)
  @Column
  userId: number | null;

  @BelongsTo(() => User, { foreignKey: "userId", as: "actor" })
  actor: User;

  @Column
  type: CrmDealActivityType | string;

  @Column
  title: string;

  @AllowNull
  @Column(DataType.TEXT)
  description: string | null;

  @AllowNull
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CrmDealActivity;
