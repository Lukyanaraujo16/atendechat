import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";

@Table({
  tableName: "AutomationAgentOsEvents",
  indexes: [
    { name: "AutomationAgentOsEvents_company_created_idx", fields: ["companyId", "createdAt"] },
    { name: "AutomationAgentOsEvents_company_event_idx", fields: ["companyId", "eventName"] },
    { name: "AutomationAgentOsEvents_company_module_idx", fields: ["companyId", "moduleKey"] }
  ]
})
class AutomationAgentOsEvent extends Model<AutomationAgentOsEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(64))
  moduleKey: string;

  @Column(DataType.STRING(96))
  eventName: string;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  entityId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(96))
  traceId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(96))
  correlationId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  sessionId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  executionId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(16))
  severity: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(32))
  origin: string | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  payload: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationAgentOsEvent;
