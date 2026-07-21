/**
 * Fase IA 2.1C — Operation Runtime (escrita governada).
 */

export const AUTOMATION_OPERATION_RUNTIME_VERSION = "2.1.0-c";

export const OPERATION_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical"
] as const;

export type OperationRiskLevel = (typeof OPERATION_RISK_LEVELS)[number];

export const OPERATION_SIDE_EFFECTS = [
  "database_write",
  "message_send",
  "external_request",
  "destructive"
] as const;

export type OperationSideEffectType =
  (typeof OPERATION_SIDE_EFFECTS)[number];

export const OPERATION_STATUSES = [
  "success",
  "failure",
  "denied",
  "waiting_confirmation",
  "dry_run",
  "preview",
  "conflict",
  "rolled_back"
] as const;

export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export const OPERATION_ERROR_TYPES = [
  "validation",
  "permission",
  "feature",
  "tenant",
  "ownership",
  "policy",
  "confirmation",
  "idempotency",
  "timeout",
  "conflict",
  "lock",
  "not_found",
  "dependency",
  "runtime",
  "rollback_failed",
  "unexpected"
] as const;

export type OperationErrorType = (typeof OPERATION_ERROR_TYPES)[number];

export const OPERATION_EVENTS = [
  "OperationPreviewGenerated",
  "OperationDryRunExecuted",
  "OperationStarted",
  "OperationCompleted",
  "OperationFailed",
  "OperationRolledBack",
  "OperationWaitingConfirmation",
  "OperationConflict"
] as const;

export type OperationEventName = (typeof OPERATION_EVENTS)[number];

export const OPERATION_RESOURCE_TYPES = [
  "contact",
  "ticket",
  "tag",
  "note",
  "queue",
  "user"
] as const;

export type OperationResourceType =
  (typeof OPERATION_RESOURCE_TYPES)[number];

/** Campos de contato permitidos para Tools de escrita. */
export const CONTACT_ALLOWED_UPDATE_FIELDS = [
  "name",
  "email",
  "notes"
] as const;

export type ContactAllowedUpdateField =
  (typeof CONTACT_ALLOWED_UPDATE_FIELDS)[number];
