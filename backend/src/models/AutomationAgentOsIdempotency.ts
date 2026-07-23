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
  tableName: "AutomationAgentOsIdempotency",
  indexes: [
    {
      name: "AutomationAgentOsIdempotency_company_key_uq",
      unique: true,
      fields: ["companyId", "idempotencyKey"]
    },
    { name: "AutomationAgentOsIdempotency_expiresAt_idx", fields: ["expiresAt"] }
  ]
})
class AutomationAgentOsIdempotency extends Model<AutomationAgentOsIdempotency> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(191))
  idempotencyKey: string;

  @Column(DataType.STRING(64))
  entityType: string;

  @Column(DataType.STRING(128))
  entityId: string;

  @AllowNull(true)
  @Column
  expiresAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AutomationAgentOsIdempotency;
