import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  DataType,
  AllowNull,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import Invoices from "./Invoices";
import SaaSPayment from "./SaaSPayment";
import SaaSReconciliationItem from "./SaaSReconciliationItem";

/** Fase 8.3-B3.3 — status do evento (RF3.10). Todos terminais, exceto os de `PENDING`. */
export type GatewayWebhookEventStatus =
  | "received"
  | "processing"
  | "retry_scheduled"
  | "applied"
  | "replay"
  | "reconciliation"
  | "unlinked"
  | "ignored_not_saas"
  | "invalid_permanent"
  | "failed_exhausted";

export type GatewayWebhookEventType = "pix" | "devolucao" | "teste" | "invalido";

export const GATEWAY_WEBHOOK_PENDING_STATUSES: GatewayWebhookEventStatus[] = [
  "received",
  "processing",
  "retry_scheduled"
];

@Table({ tableName: "SaaSGatewayWebhookEvents" })
class SaaSGatewayWebhookEvent extends Model<SaaSGatewayWebhookEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Default("efi")
  @Column
  provider: string;

  @Column
  eventKey: string;

  @Column(DataType.STRING(16))
  eventType: GatewayWebhookEventType;

  @Default("received")
  @Column(DataType.STRING(32))
  status: GatewayWebhookEventStatus;

  @AllowNull(true)
  @Column
  txid: string | null;

  @AllowNull(true)
  @Column
  endToEndId: string | null;

  @AllowNull(true)
  @Column
  devolucaoId: string | null;

  @AllowNull(true)
  @Column(DataType.DECIMAL(12, 2))
  amount: number | string | null;

  @ForeignKey(() => Company)
  @AllowNull(true)
  @Column
  companyId: number | null;

  @ForeignKey(() => Invoices)
  @AllowNull(true)
  @Column
  invoiceId: number | null;

  @ForeignKey(() => SaaSPayment)
  @AllowNull(true)
  @Column
  paymentId: number | null;

  @ForeignKey(() => SaaSReconciliationItem)
  @AllowNull(true)
  @Column
  reconciliationItemId: number | null;

  @AllowNull(true)
  @Column
  credentialsSource: string | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  payload: Record<string, unknown> | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  result: Record<string, unknown> | null;

  @Default(0)
  @Column
  attempts: number;

  @Column
  nextAttemptAt: Date;

  @AllowNull(true)
  @Column
  lockedBy: string | null;

  @AllowNull(true)
  @Column
  lockedAt: Date | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  lastError: string | null;

  @Default([])
  @Column(DataType.JSONB)
  attemptLog: Array<Record<string, unknown>>;

  @Default([])
  @Column(DataType.JSONB)
  adminActions: Array<Record<string, unknown>>;

  @Column
  receivedAt: Date;

  @AllowNull(true)
  @Column
  processedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SaaSGatewayWebhookEvent;
