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
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";

export type CrmAutomationTriggerType =
  | "stage_changed"
  | "stale_for_days"
  | "priority_changed";

export type CrmAutomationActionType =
  | "create_follow_up"
  | "mark_attention"
  | "notify_user";

@Table({ tableName: "CrmAutomationRules" })
class CrmAutomationRule extends Model<CrmAutomationRule> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  name: string;

  @Default(true)
  @Column
  enabled: boolean;

  @Column
  triggerType: CrmAutomationTriggerType | string;

  @Default({})
  @Column(DataType.JSON)
  triggerConfig: Record<string, unknown>;

  @Column
  actionType: CrmAutomationActionType | string;

  @Default({})
  @Column(DataType.JSON)
  actionConfig: Record<string, unknown>;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CrmAutomationRule;
