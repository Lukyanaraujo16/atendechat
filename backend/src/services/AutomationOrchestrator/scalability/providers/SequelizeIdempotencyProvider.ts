import { Op } from "sequelize";
import AutomationAgentOsIdempotency from "../../../../models/AutomationAgentOsIdempotency";
import {
  AgentOsIdempotencyProvider,
  AgentOsIdempotencyRecord
} from "./types";
import { getAgentOsPersistenceBackend } from "../../persistence/persistenceUtils";
import { InMemoryIdempotencyProvider } from "./InMemoryProviders";

function toRecord(row: any): AgentOsIdempotencyRecord {
  const plain = typeof row.toJSON === "function" ? row.toJSON() : row;
  const meta = (plain.payloadSanitized || plain.metadata || {}) as any;
  return {
    key: plain.idempotencyKey,
    companyId: plain.companyId,
    operationType: plain.entityType || meta.operationType || "unknown",
    requestHash: meta.requestHash || "",
    status: meta.status || "PROCESSING",
    ownerId: meta.ownerId || "",
    resultReference: plain.entityId || meta.resultReference || null,
    errorCode: meta.errorCode || null,
    attemptCount: meta.attemptCount || 1,
    lockedUntil: meta.lockedUntil ? new Date(meta.lockedUntil) : null,
    expiresAt: plain.expiresAt ? new Date(plain.expiresAt) : new Date(),
    createdAt: plain.createdAt ? new Date(plain.createdAt) : new Date(),
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt) : new Date()
  };
}

/**
 * Idempotência persistente via Sequelize.
 * Usa unique (companyId, key); race → conflict handling.
 * Metadados em entityType/entityId + JSON auxiliar via entityId encoding quando necessário.
 * Wave 4: status/hash em campo entityType prefix e entityId JSON-lite.
 */
export class SequelizeIdempotencyProvider implements AgentOsIdempotencyProvider {
  private memFallback = new InMemoryIdempotencyProvider();

  private async find(companyId: number, key: string) {
    return AutomationAgentOsIdempotency.findOne({
      where: { companyId, idempotencyKey: key }
    });
  }

  async claim(input: {
    companyId: number;
    key: string;
    operationType: string;
    requestHash: string;
    ownerId: string;
    ttlMs: number;
    processingTimeoutMs: number;
  }) {
    if (getAgentOsPersistenceBackend() !== "sequelize") {
      return this.memFallback.claim(input);
    }

    const existing = await this.find(input.companyId, input.key);
    const t = Date.now();
    if (existing) {
      const rec = toRecord(existing);
      // Recover metadata from entityId if JSON
      try {
        const meta = JSON.parse(String(existing.entityId || "{}"));
        if (meta && typeof meta === "object") {
          rec.requestHash = meta.requestHash || rec.requestHash;
          rec.status = meta.status || rec.status;
          rec.ownerId = meta.ownerId || rec.ownerId;
          rec.resultReference = meta.resultReference ?? rec.resultReference;
          rec.errorCode = meta.errorCode ?? rec.errorCode;
          rec.attemptCount = meta.attemptCount || rec.attemptCount;
          rec.lockedUntil = meta.lockedUntil
            ? new Date(meta.lockedUntil)
            : rec.lockedUntil;
        }
      } catch {
        /* entityId plain */
      }

      if (rec.requestHash && rec.requestHash !== input.requestHash) {
        return { outcome: "conflict_payload" as const, record: rec };
      }
      if (rec.status === "COMPLETED") {
        return { outcome: "replay" as const, record: rec };
      }
      if (rec.status === "AMBIGUOUS") {
        return { outcome: "ambiguous" as const, record: rec };
      }
      if (
        rec.status === "PROCESSING" &&
        rec.lockedUntil &&
        rec.lockedUntil.getTime() > t
      ) {
        return { outcome: "in_progress" as const, record: rec };
      }
      // reclaim expired processing
      const meta = {
        requestHash: input.requestHash,
        status: "PROCESSING",
        ownerId: input.ownerId,
        attemptCount: (rec.attemptCount || 0) + 1,
        lockedUntil: new Date(t + input.processingTimeoutMs).toISOString(),
        operationType: input.operationType
      };
      await existing.update({
        entityType: input.operationType,
        entityId: JSON.stringify(meta),
        expiresAt: new Date(t + input.ttlMs)
      } as any);
      return {
        outcome: "acquired" as const,
        record: toRecord({ ...existing.toJSON(), entityId: JSON.stringify(meta) })
      };
    }

    const meta = {
      requestHash: input.requestHash,
      status: "PROCESSING",
      ownerId: input.ownerId,
      attemptCount: 1,
      lockedUntil: new Date(t + input.processingTimeoutMs).toISOString(),
      operationType: input.operationType
    };
    try {
      const created = await AutomationAgentOsIdempotency.create({
        companyId: input.companyId,
        idempotencyKey: input.key,
        entityType: input.operationType,
        entityId: JSON.stringify(meta),
        expiresAt: new Date(t + input.ttlMs)
      } as any);
      return { outcome: "acquired" as const, record: toRecord(created) };
    } catch (err: any) {
      // unique race — re-read
      const again = await this.find(input.companyId, input.key);
      if (again) {
        return this.claim(input);
      }
      throw err;
    }
  }

  private async patchMeta(
    companyId: number,
    key: string,
    ownerId: string,
    patch: Record<string, unknown>
  ) {
    const row = await this.find(companyId, key);
    if (!row) return;
    let meta: any = {};
    try {
      meta = JSON.parse(String(row.entityId || "{}"));
    } catch {
      meta = {};
    }
    if (meta.ownerId && meta.ownerId !== ownerId) return;
    const next = { ...meta, ...patch };
    await row.update({
      entityId: JSON.stringify(next),
      entityType: (next.operationType as string) || row.entityType
    } as any);
  }

  async complete(input: {
    companyId: number;
    key: string;
    resultReference: string;
    ownerId: string;
  }) {
    if (getAgentOsPersistenceBackend() !== "sequelize") {
      return this.memFallback.complete(input);
    }
    await this.patchMeta(input.companyId, input.key, input.ownerId, {
      status: "COMPLETED",
      resultReference: input.resultReference,
      lockedUntil: null
    });
  }

  async fail(input: {
    companyId: number;
    key: string;
    ownerId: string;
    errorCode: string;
    final: boolean;
  }) {
    if (getAgentOsPersistenceBackend() !== "sequelize") {
      return this.memFallback.fail(input);
    }
    await this.patchMeta(input.companyId, input.key, input.ownerId, {
      status: input.final ? "FAILED_FINAL" : "FAILED_RETRYABLE",
      errorCode: input.errorCode,
      lockedUntil: null
    });
  }

  async markAmbiguous(input: {
    companyId: number;
    key: string;
    ownerId: string;
    errorCode: string;
  }) {
    if (getAgentOsPersistenceBackend() !== "sequelize") {
      return this.memFallback.markAmbiguous(input);
    }
    await this.patchMeta(input.companyId, input.key, input.ownerId, {
      status: "AMBIGUOUS",
      errorCode: input.errorCode,
      lockedUntil: null
    });
  }
}

/** Purge expired idempotency rows (batch). */
export async function purgeExpiredIdempotency(limit = 200): Promise<number> {
  if (getAgentOsPersistenceBackend() !== "sequelize") return 0;
  const rows = await AutomationAgentOsIdempotency.findAll({
    where: { expiresAt: { [Op.lt]: new Date() } },
    limit,
    attributes: ["id"]
  });
  if (!rows.length) return 0;
  const ids = rows.map(r => r.id);
  return AutomationAgentOsIdempotency.destroy({ where: { id: { [Op.in]: ids } } });
}
