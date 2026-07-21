import {
  OperationAudit,
  OperationChangedField,
  OperationError,
  OperationPreview,
  OperationRollback,
  OperationSnapshot,
  OperationTransaction
} from "./OperationContract";
import { OperationStatus } from "../../../../../config/automationOperationConstants";

export type OperationInternalResult = {
  status: OperationStatus;
  operationId: string;
  operationVersion: string;
  preview: OperationPreview | null;
  before: OperationSnapshot[];
  after: OperationSnapshot[];
  changedFields: OperationChangedField[];
  data: Record<string, unknown>;
  warnings: string[];
  errors: OperationError[];
  metrics: {
    durationMs: number;
    dryRun: boolean;
    previewOnly: boolean;
    lockAcquired: boolean;
    transactionUsed: boolean;
  };
  transaction: OperationTransaction | null;
  rollback: OperationRollback;
  audit: OperationAudit;
  modelPayload?: Record<string, unknown>;
};

export type OperationModelResult = {
  status: "success" | "failure" | "denied" | "preview" | "dry_run" | "waiting_confirmation" | "conflict";
  operation: string;
  summary: string;
  changes?: Array<{ field: string; from?: unknown; to?: unknown }>;
  warnings?: string[];
  dryRun?: boolean;
};
