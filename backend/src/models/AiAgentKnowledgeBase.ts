import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import AiAgent from "./AiAgent";
import AiKnowledgeBase from "./AiKnowledgeBase";

@Table({
  tableName: "AiAgentKnowledgeBases",
  indexes: [
    {
      name: "AiAgentKnowledgeBases_company_agent_base_unique",
      unique: true,
      fields: ["companyId", "aiAgentId", "knowledgeBaseId"]
    },
    {
      name: "AiAgentKnowledgeBases_company_agent_enabled_idx",
      fields: ["companyId", "aiAgentId", "enabled"]
    }
  ]
})
class AiAgentKnowledgeBase extends Model<AiAgentKnowledgeBase> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiAgent)
  @Column
  aiAgentId: number;

  @BelongsTo(() => AiAgent)
  aiAgent: AiAgent;

  @ForeignKey(() => AiKnowledgeBase)
  @Column
  knowledgeBaseId: number;

  @BelongsTo(() => AiKnowledgeBase)
  knowledgeBase: AiKnowledgeBase;

  @Default(true)
  @Column
  enabled: boolean;

  /** Menor número = maior prioridade. */
  @Default(100)
  @Column
  priority: number;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  createdBy: number | null;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column
  updatedBy: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentKnowledgeBase;
