import { randomUUID } from "crypto";
import { Transaction } from "sequelize";
import {
  AutomationOperationContract,
  OperationChangedField,
  OperationContext,
  OperationError,
  OperationPreview,
  OperationSnapshot,
  classifyOperationError
} from "./contracts/OperationContract";
import { OperationInternalResult } from "./contracts/OperationResultTypes";
import {
  acquireMultipleResourceLocks,
  releaseOperationResourceLock
} from "./OperationResourceLock";
import { emitToolEvent } from "../ToolEventBus";
import { toOperationModelResult } from "./OperationModelResultAdapter";
import { sanitizeToolSnapshot } from "../sanitizeToolSnapshot";

export type RunOperationInput = {
  operation: AutomationOperationContract;
  toolCtx: OperationContext["toolCtx"];
  input: Record<string, unknown>;
  dryRun?: boolean;
  previewOnly?: boolean;
  confirmed?: boolean;
};

function diffSnapshots(
  before: OperationSnapshot[],
  after: OperationSnapshot[]
): OperationChangedField[] {
  const changed: OperationChangedField[] = [];
  const afterByKey = new Map(
    after.map(s => [`${s.resourceType}:${s.resourceId}`, s])
  );

  for (const b of before) {
    const key = `${b.resourceType}:${b.resourceId}`;
    const a = afterByKey.get(key);
    if (!a) continue;
    const fields = new Set([
      ...Object.keys(b.fields || {}),
      ...Object.keys(a.fields || {})
    ]);
    for (const field of fields) {
      const bv = b.fields?.[field];
      const av = a.fields?.[field];
      if (JSON.stringify(bv) !== JSON.stringify(av)) {
        changed.push({ field: `${key}.${field}`, before: bv, after: av });
      }
    }
  }
  return changed.slice(0, 50);
}

function emptyPreview(operationId: string): OperationPreview {
  return {
    operationId,
    summary: "empty",
    current: {},
    proposed: {},
    validations: [],
    warnings: [],
    affectedResources: [],
    blockers: [],
    dryRunCapable: true
  };
}

/**
 * Runtime transacional de Operations.
 * Write Tools só alteram dados através deste caminho.
 */
export async function runOperationViaRuntime(
  input: RunOperationInput
): Promise<OperationInternalResult & { modelResult: ReturnType<typeof toOperationModelResult> }> {
  const started = Date.now();
  const manifest = input.operation.manifest();
  const transactionId = randomUUID();
  const dryRun = input.dryRun === true;
  const previewOnly = input.previewOnly === true;
  const confirmed = input.confirmed === true;

  const opCtx: OperationContext = {
    toolCtx: input.toolCtx,
    dryRun,
    previewOnly,
    confirmed,
    requestId: input.toolCtx.requestId || transactionId,
    correlationId: input.toolCtx.correlationId,
    transactionId,
    metadata: input.toolCtx.metadata
  };

  const companyId = input.toolCtx.companyId;
  let lockKeys: string[] = [];
  let transaction: Transaction | null = null;
  let before: OperationSnapshot[] = [];
  let after: OperationSnapshot[] = [];
  let preview: OperationPreview | null = null;
  const warnings: string[] = [];
  const errors: OperationError[] = [];
  let rollback = {
    requested: false,
    supported: manifest.supportsRollback,
    succeeded: false,
    message: undefined as string | undefined
  };
  let txState = {
    id: transactionId,
    opened: false,
    committed: false,
    rolledBack: false
  };

  const finish = (
    status: OperationInternalResult["status"],
    data: Record<string, unknown> = {},
    extraErrors: OperationError[] = []
  ) => {
    const allErrors = [...errors, ...extraErrors];
    const changedFields = diffSnapshots(before, after);
    const internal: OperationInternalResult = {
      status,
      operationId: manifest.id,
      operationVersion: manifest.version,
      preview,
      before: before.map(s => ({
        ...s,
        fields: sanitizeToolSnapshot(s.fields)
      })),
      after: after.map(s => ({
        ...s,
        fields: sanitizeToolSnapshot(s.fields)
      })),
      changedFields,
      data: sanitizeToolSnapshot(data),
      warnings,
      errors: allErrors,
      metrics: {
        durationMs: Date.now() - started,
        dryRun,
        previewOnly,
        lockAcquired: lockKeys.length > 0,
        transactionUsed: txState.opened
      },
      transaction: txState,
      rollback,
      audit: {
        operationId: manifest.id,
        operationVersion: manifest.version,
        companyId,
        requestedBy: input.toolCtx.userId ?? null,
        source: input.toolCtx.source,
        dryRun,
        previewOnly,
        confirmed,
        transactionId,
        durationMs: Date.now() - started,
        status
      },
      modelPayload: {
        summary: preview?.summary,
        changes: changedFields.map(c => ({
          field: c.field,
          from: c.before,
          to: c.after
        })),
        dryRun,
        status
      }
    };
    return {
      ...internal,
      modelResult: toOperationModelResult(internal)
    };
  };

  try {
    if (!companyId || companyId < 1) {
      throw new Error("OPERATION_TENANT: invalid_company");
    }

    for (const perm of manifest.requiredPermissions) {
      if (!(input.toolCtx.permissions || []).includes(perm)) {
        throw new Error(`OPERATION_PERMISSION: missing:${perm}`);
      }
    }

    for (const feat of manifest.requiredFeatures) {
      if (input.toolCtx.featureFlags?.[feat] !== true) {
        throw new Error(`OPERATION_FEATURE: missing:${feat}`);
      }
    }

    if (typeof input.operation.validate === "function") {
      await input.operation.validate(opCtx, input.input);
    }

    preview = await input.operation.preview(opCtx, input.input);
    await emitToolEvent({
      companyId,
      eventName: "OperationPreviewGenerated",
      toolId: manifest.id,
      payload: {
        summary: preview.summary,
        blockers: preview.blockers,
        warnings: preview.warnings
      }
    });

    if (preview.blockers.length) {
      return finish("denied", {}, [
        {
          code: "VALIDATION",
          type: "validation",
          message: preview.blockers.join("; "),
          retryable: false
        }
      ]);
    }

    if (previewOnly) {
      return finish("preview", { preview });
    }

    if (
      manifest.requiresConfirmation &&
      !dryRun &&
      !confirmed &&
      input.toolCtx.metadata?.confirmationStatus !== "approved"
    ) {
      await emitToolEvent({
        companyId,
        eventName: "OperationWaitingConfirmation",
        toolId: manifest.id,
        payload: { summary: preview.summary }
      });
      return finish("waiting_confirmation", { preview });
    }

    // Locks por recurso afetado
    const resources = preview.affectedResources.map(r => ({
      type: r.type,
      id: r.id
    }));
    if (resources.length && !previewOnly) {
      const locks = await acquireMultipleResourceLocks({
        companyId,
        resources,
        ttlSeconds: Math.ceil(manifest.timeoutPolicy.timeoutMs / 1000) + 30
      });
      if (!locks.acquired) {
        throw new Error(
          locks.redisUnavailable
            ? "OPERATION_LOCK: unavailable"
            : "OPERATION_LOCK: resource_busy"
        );
      }
      lockKeys = locks.keys;
    }

    before = await input.operation.captureBefore(opCtx, input.input);

    if (typeof input.operation.detectConflict === "function" && !dryRun) {
      const conflict = await input.operation.detectConflict(
        opCtx,
        input.input,
        before
      );
      if (conflict) {
        await emitToolEvent({
          companyId,
          eventName: "OperationConflict",
          toolId: manifest.id,
          payload: { type: conflict.type, message: conflict.message }
        });
        return finish("conflict", {}, [conflict]);
      }
    }

    if (dryRun) {
      // Simula after = proposed fields merged (sem persistir)
      after = before.map(s => {
        const proposed = preview?.proposed || {};
        const resourceKey = String(s.resourceId);
        const patch =
          (proposed[resourceKey] as Record<string, unknown>) ||
          (proposed as Record<string, unknown>);
        return {
          ...s,
          fields: { ...s.fields, ...sanitizeToolSnapshot(patch) },
          capturedAt: new Date().toISOString()
        };
      });
      warnings.push(...(preview?.warnings || []));
      await emitToolEvent({
        companyId,
        eventName: "OperationDryRunExecuted",
        toolId: manifest.id,
        payload: { summary: preview?.summary }
      });
      return finish("dry_run", {
        preview,
        wouldChange: diffSnapshots(before, after)
      });
    }

    // Execução real
    await emitToolEvent({
      companyId,
      eventName: "OperationStarted",
      toolId: manifest.id,
      payload: { transactionId }
    });

    if (manifest.transactionRequired) {
      const sequelize = (await import("../../../../database")).default;
      transaction = await sequelize.transaction();
      txState.opened = true;
    }

    try {
      const execResult = await input.operation.execute(
        opCtx,
        input.input,
        transaction
      );
      after = execResult.afterSnapshots || [];
      if (transaction) {
        await transaction.commit();
        txState.committed = true;
        transaction = null;
      }

      await emitToolEvent({
        companyId,
        eventName: "OperationCompleted",
        toolId: manifest.id,
        payload: {
          transactionId,
          changed: diffSnapshots(before, after).length
        }
      });

      return finish("success", execResult.data || {});
    } catch (execErr) {
      if (transaction) {
        try {
          await transaction.rollback();
          txState.rolledBack = true;
        } catch {
          // ignore
        }
        transaction = null;
      }

      rollback.requested = true;
      if (manifest.supportsRollback && typeof input.operation.rollback === "function") {
        try {
          await input.operation.rollback(opCtx, input.input, before);
          rollback.succeeded = true;
          await emitToolEvent({
            companyId,
            eventName: "OperationRolledBack",
            toolId: manifest.id,
            payload: { transactionId, ok: true }
          });
        } catch (rbErr) {
          rollback.succeeded = false;
          rollback.message =
            rbErr instanceof Error ? rbErr.message.slice(0, 300) : "rollback_failed";
          await emitToolEvent({
            companyId,
            eventName: "OperationRolledBack",
            toolId: manifest.id,
            payload: { transactionId, ok: false }
          });
        }
      } else {
        rollback.message = "unsupported";
      }

      throw execErr;
    }
  } catch (err) {
    const classified = classifyOperationError(err);
    errors.push(classified);
    await emitToolEvent({
      companyId,
      eventName: "OperationFailed",
      toolId: manifest.id,
      payload: { type: classified.type, code: classified.code }
    });
    const status =
      classified.type === "conflict"
        ? "conflict"
        : classified.type === "confirmation"
          ? "waiting_confirmation"
          : classified.type === "permission" ||
              classified.type === "feature" ||
              classified.type === "policy" ||
              classified.type === "tenant"
            ? "denied"
            : rollback.requested
              ? "rolled_back"
              : "failure";
    return finish(status as OperationInternalResult["status"], {}, []);
  } finally {
    for (const key of lockKeys) {
      await releaseOperationResourceLock(key);
    }
  }
}

export default { runOperationViaRuntime };
