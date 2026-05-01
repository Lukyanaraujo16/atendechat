import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  HasMany,
  DataType
} from "sequelize-typescript";
import PlanFeature from "./PlanFeature";

@Table
class Plan extends Model<Plan> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Unique
  @Column
  name: string;

  @Column
  users: number;

  @Column
  connections: number;

  @Column
  queues: number;

  @Column
  value: number;

  /** Limite de armazenamento do plano (GB). null = ilimitado na aplicação. */
  @Column({ type: DataType.DECIMAL(10, 2), allowNull: true })
  storageLimitGb: string | number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  useSchedules: boolean;   

  @Column
  useCampaigns: boolean; 
  
  @Column
  useInternalChat: boolean;   
  
  @Column
  useExternalApi: boolean;   

  @Column
  useKanban: boolean;

  @Column
  useOpenAi: boolean;

  @Column
  useIntegrations: boolean;

  @HasMany(() => PlanFeature)
  planFeatures: PlanFeature[];
}

export default Plan;
