import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DeletedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";

@Table({
  tableName: "AutomationCognitiveMemories",
  paranoid: true,
  indexes: [
    { name: "AutomationCognitiveMemories_company_type_idx", fields: ["companyId", "memoryType"] },
    { name: "AutomationCognitiveMemories_company_agent_idx", fields: ["companyId", "agentId"] },
    { name: "AutomationCognitiveMemories_company_ticket_idx", fields: ["companyId", "ticketId"] },
    { name: "AutomationCognitiveMemories_company_contact_idx", fields: ["companyId", "contactId"] },
    { name: "AutomationCognitiveMemories_company_updated_idx", fields: ["companyId", "updatedAt"] },
    { name: "AutomationCognitiveMemories_company_importance_idx", fields: ["companyId", "importance"] }
  ]
})
class AutomationCognitiveMemory extends Model<AutomationCognitiveMemory> {
  @PrimaryKey
  @Column(DataType.STRING(64))
  id: string;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column(DataType.STRING(32))
  memoryType: string;

  @AllowNull(true)
  @Column
  agentId: number | null;

  @AllowNull(true)
  @Column
  ticketId: number | null;

  @AllowNull(true)
  @Column
  contactId: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  goalId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  executionId: string | null;

  @Column(DataType.STRING(255))
  title: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  summary: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  content: string | null;

  @Default(false)
  @Column
  contentEncrypted: boolean;

  @AllowNull(true)
  @Column(DataType.JSON)
  entities: unknown;

  @AllowNull(true)
  @Column(DataType.JSON)
  tags: unknown;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  confidence: number | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  importance: number | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  source: string | null;

  @Default(1)
  @Column
  version: number;

  @AllowNull(true)
  @Column(DataType.JSON)
  metadata: Record<string, unknown> | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @DeletedAt
  deletedAt: Date | null;
}

export default AutomationCognitiveMemory;
