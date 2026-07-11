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
import AiAgentSimulationMessage from "./AiAgentSimulationMessage";
import User from "./User";

@Table({
  tableName: "AiAgentSimulationMessageReviews",
  indexes: [
    {
      name: "AiAgentSimulationMessageReviews_company_message_uq",
      unique: true,
      fields: ["companyId", "simulationMessageId"]
    }
  ]
})
class AiAgentSimulationMessageReview extends Model<AiAgentSimulationMessageReview> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => AiAgentSimulationMessage)
  @Column
  simulationMessageId: number;

  @BelongsTo(() => AiAgentSimulationMessage)
  simulationMessage: AiAgentSimulationMessage;

  @Column(DataType.STRING(16))
  rating: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  tags: string[] | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  note: string | null;

  @ForeignKey(() => User)
  @Column
  reviewedBy: number;

  @BelongsTo(() => User)
  reviewer: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AiAgentSimulationMessageReview;
