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
  | "delete_cert"
  | "revoke"
  | "activate"
  | "deactivate"
  | "test_auth"
  /** Registro de homologação (D-P17). Criado só a partir da B3.3. */
  | "homologate"
  /** Cadastro do webhook Pix pelo Super Admin (B3.2, RF2.7). */
  | "webhook_register"
  /** B3.3 (A1): reprocessamento e classificação manual de evento de webhook. */
  | "webhook_event_reprocess"
  | "webhook_event_classify"
  /** B3.3 (A1, R-11): resolução de item de conciliação. */
  | "reconciliation_resolve"
  /** B3.3 (A1, D-P10): varredura Pix Efí × local. */
  | "pix_sweep"
  /** B3.4 (B34-T10): troca do ambiente da API Efí do slot; apaga credenciais e P12. */
  | "change_environment";

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
