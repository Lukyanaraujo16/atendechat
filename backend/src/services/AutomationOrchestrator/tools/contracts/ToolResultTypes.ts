import { AutomationToolStatus } from "../../../../config/automationToolConstants";
import { ToolError } from "./ToolContract";

/**
 * Resultado interno — Runtime, Replay, Logs, Auditoria, Métricas, Debug.
 * NUNCA enviar ao modelo.
 */
export type ToolInternalResult = {
  status: AutomationToolStatus;
  data: Record<string, unknown>;
  displayData: Record<string, unknown>;
  metrics: {
    durationMs: number;
    attempts: number;
    timedOut: boolean;
    retries: number;
    rolledBack: boolean;
    resultCount?: number;
    emptyResult?: boolean;
    cacheHit?: boolean;
    cacheMiss?: boolean;
  };
  logs: string[];
  warnings: string[];
  errors: ToolError[];
  idempotencyKey: string | null;
  executionId: string | null;
  sideEffectCommitted: boolean;
  rollbackAvailable: boolean;
  confirmationStatus?: string;
  audit?: Record<string, unknown>;
  /** Payload bruto mínimo para adaptação ao modelo. */
  modelPayload?: Record<string, unknown>;
};

/**
 * Resultado exclusivo para o modelo (function calling futuro).
 * Sem IDs internos, companyId, métricas, logs ou debug.
 */
export type ToolModelResult = {
  status: "success" | "failure" | "denied" | "empty" | "skipped";
  tool: string;
  summary?: string;
  item?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  count?: number;
  hasMore?: boolean;
  warnings?: string[];
};
