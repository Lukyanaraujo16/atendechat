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
  Default
} from "sequelize-typescript";
import Plan from "./Plan";

@Table
class PlanFeature extends Model<PlanFeature> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Plan)
  @AllowNull(false)
  @Column
  planId: number;

  @BelongsTo(() => Plan)
  plan: Plan;

  @AllowNull(false)
  @Column
  featureKey: string;

  @Default(true)
  @AllowNull(false)
  @Column
  enabled: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PlanFeature;
