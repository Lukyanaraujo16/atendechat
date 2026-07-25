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
import User from "./User";

/**
 * Permissões globais de plataforma (sem companyId).
 * Distinto de UserFeaturePermission (tenant + plano).
 */
@Table({
  tableName: "PlatformUserPermissions"
})
class PlatformUserPermission extends Model<PlatformUserPermission> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @AllowNull(false)
  @Column
  permissionKey: string;

  @Default(true)
  @AllowNull(false)
  @Column
  enabled: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PlatformUserPermission;
