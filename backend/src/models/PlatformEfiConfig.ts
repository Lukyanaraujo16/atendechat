import {
  AllowNull,
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";

export type PlatformEfiSlot = "homologation" | "production";
export type PlatformEfiEnvironment = "sandbox" | "production";
export type PlatformEfiConfigStatus =
  | "empty"
  | "incomplete"
  | "configured"
  | "auth_validated"
  | "operational"
  | "revoked";

@Table({
  tableName: "PlatformEfiConfigs",
  indexes: [
    {
      name: "platform_efi_configs_slot_unique",
      unique: true,
      fields: ["slot"]
    }
  ]
})
class PlatformEfiConfig extends Model<PlatformEfiConfig> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  /** Slot global — sem companyId. */
  @AllowNull(false)
  @Column(DataType.STRING(32))
  slot: PlatformEfiSlot;

  @AllowNull(false)
  @Column(DataType.STRING(32))
  efiEnvironment: PlatformEfiEnvironment;

  @AllowNull(false)
  @Default("empty")
  @Column(DataType.STRING(32))
  status: PlatformEfiConfigStatus;

  @AllowNull(true)
  @Column(DataType.TEXT)
  clientIdEncrypted: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  clientSecretEncrypted: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  clientIdMasked: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  pixKeyEncrypted: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  pixKeyMasked: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  webhookSecretEncrypted: string | null;

  @AllowNull(false)
  @Default(false)
  @Column
  webhookSecretConfigured: boolean;

  @AllowNull(true)
  @Column(DataType.TEXT)
  cobrancasClientIdEncrypted: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  cobrancasClientSecretEncrypted: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  cobrancasClientIdMasked: string | null;

  /** PKCS#12 cifrado (fonte durável; sem volume Docker dedicado a certs). */
  @AllowNull(true)
  @Column(DataType.TEXT)
  certificateEncrypted: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(128))
  certificateStorageKey: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(64))
  certificateFingerprint: string | null;

  @AllowNull(true)
  @Column
  certificateUploadedAt: Date | null;

  @AllowNull(true)
  @Column
  lastAuthTestAt: Date | null;

  @AllowNull(true)
  @Column
  lastAuthTestOk: boolean | null;

  @AllowNull(true)
  @Column(DataType.STRING(240))
  lastAuthTestMessage: string | null;

  @AllowNull(true)
  @Column
  activatedAt: Date | null;

  @AllowNull(true)
  @Column
  activatedByUserId: number | null;

  @AllowNull(true)
  @Column
  updatedByUserId: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default PlatformEfiConfig;
