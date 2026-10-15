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
import PlatformEfiConfig, { PlatformEfiSlot } from "./PlatformEfiConfig";

export type PlatformEfiAuditAction =
  | "create"
  | "update_meta"
  | "rotate_secret"
  | "upload_cert"
  | "revoke"
  | "activate"
  | "deactivate"
  | "test_auth";

@Table({
  tableName: "PlatformEfiConfigAudits",
  indexes: [
    {
      name: "platform_efi_config_audits_slot_created_idx",
      fields: ["slot", "createdAt"]
    },
    {
      name: "platform_efi_config_audits_config_id_idx",
      fields: ["configId"]
    }
  ]
})
class PlatformEfiConfigAudit extends Model<PlatformEfiConfigAudit> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => PlatformEfiConfig)
  @AllowNull(true)
  @Column
  configId: number | null;

  @BelongsTo(() => PlatformEfiConfig)
  config: PlatformEfiConfig;

  @AllowNull(false)
  @Column(DataType.STRING(32))
  slot: PlatformEfiSlot;

  @AllowNull(true)
  @Column
  actorUserId: number | null;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  action: PlatformEfiAuditAction;

  /** JSON string sem secrets — apenas resumo seguro. */
  @AllowNull(true)
  @Column(DataType.TEXT)
  diffSummary: string | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PlatformEfiConfigAudit;
