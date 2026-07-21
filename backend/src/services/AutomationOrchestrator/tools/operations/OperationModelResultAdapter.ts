import {
  OperationInternalResult,
  OperationModelResult
} from "./contracts/OperationResultTypes";

/**
 * Adapter Operation Internal → Model.
 * Nunca expõe before/after completos, transactionId, audit ou metrics.
 */
export function toOperationModelResult(
  internal: OperationInternalResult
): OperationModelResult {
  const statusMap: Record<string, OperationModelResult["status"]> = {
    success: "success",
    failure: "failure",
    denied: "denied",
    preview: "preview",
    dry_run: "dry_run",
    waiting_confirmation: "waiting_confirmation",
    conflict: "conflict",
    rolled_back: "failure"
  };

  const changes = (internal.changedFields || []).slice(0, 30).map(c => ({
    field: c.field,
    from: c.before,
    to: c.after
  }));

  return {
    status: statusMap[internal.status] || "failure",
    operation: internal.operationId,
    summary:
      internal.preview?.summary ||
      internal.errors[0]?.message ||
      internal.status,
    changes: changes.length ? changes : undefined,
    warnings: (internal.warnings || []).slice(0, 5),
    dryRun: internal.metrics.dryRun === true
  };
}

export function diffOperationInternalVsModel(
  internal: OperationInternalResult,
  model: OperationModelResult
): Record<string, unknown> {
  return {
    hiddenFromModel: [
      "before",
      "after",
      "audit",
      "transaction",
      "metrics",
      "resourceIds"
    ],
    internalStatus: internal.status,
    modelStatus: model.status,
    changedFieldCount: internal.changedFields.length,
    snapshotCount: {
      before: internal.before.length,
      after: internal.after.length
    }
  };
}

export default toOperationModelResult;
