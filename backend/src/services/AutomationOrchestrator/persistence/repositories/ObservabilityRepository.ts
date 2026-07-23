import { Op, Transaction } from "sequelize";
import AutomationAgentOsAudit from "../../../../models/AutomationAgentOsAudit";
import AutomationAgentOsEvent from "../../../../models/AutomationAgentOsEvent";
import AutomationAgentOsMetric from "../../../../models/AutomationAgentOsMetric";
import AutomationAgentOsReplay from "../../../../models/AutomationAgentOsReplay";
import AutomationAgentOsSetting from "../../../../models/AutomationAgentOsSetting";
import AutomationAgentOsIdempotency from "../../../../models/AutomationAgentOsIdempotency";
import {
  AGENTOS_RETENTION_DAYS
} from "../../../../config/automationAgentOsPersistenceConstants";
import {
  assertCompanyId,
  getAgentOsPersistenceBackend,
  persistAsync
} from "../persistenceUtils";

export class ObservabilityRepository {
  async writeAudit(
    input: {
      companyId: number;
      moduleKey: string;
      action: string;
      agentId?: string | null;
      sessionId?: string | null;
      userId?: number | null;
      previousState?: string | null;
      newState?: string | null;
      reasonCodes?: unknown;
      payloadSanitized?: Record<string, unknown> | null;
    },
    transaction?: Transaction
  ) {
    assertCompanyId(input.companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return null;
    return AutomationAgentOsAudit.create(
      {
        companyId: input.companyId,
        moduleKey: input.moduleKey,
        action: input.action,
        agentId: input.agentId ?? null,
        sessionId: input.sessionId ?? null,
        userId: input.userId ?? null,
        previousState: input.previousState ?? null,
        newState: input.newState ?? null,
        reasonCodes: input.reasonCodes ?? null,
        payloadSanitized: input.payloadSanitized ?? null
      } as any,
      { transaction }
    );
  }

  writeAuditFireAndForget(input: Parameters<ObservabilityRepository["writeAudit"]>[0]) {
    persistAsync(() => this.writeAudit(input), "audit");
  }

  async listAudits(
    companyId: number,
    opts?: {
      agentId?: string;
      sessionId?: string;
      moduleKey?: string;
      from?: Date;
      to?: Date;
      limit?: number;
    }
  ) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return [];
    const where: any = { companyId };
    if (opts?.agentId) where.agentId = opts.agentId;
    if (opts?.sessionId) where.sessionId = opts.sessionId;
    if (opts?.moduleKey) where.moduleKey = opts.moduleKey;
    if (opts?.from || opts?.to) {
      where.createdAt = {};
      if (opts.from) where.createdAt[Op.gte] = opts.from;
      if (opts.to) where.createdAt[Op.lte] = opts.to;
    }
    return AutomationAgentOsAudit.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: opts?.limit || 100
    });
  }

  async writeEvent(
    input: {
      companyId: number;
      moduleKey: string;
      eventName: string;
      entityId?: string | null;
      payload?: Record<string, unknown> | null;
      traceId?: string | null;
      correlationId?: string | null;
      sessionId?: string | null;
      executionId?: string | null;
      severity?: string | null;
      origin?: string | null;
    },
    transaction?: Transaction
  ) {
    assertCompanyId(input.companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return null;
    const p = input.payload || {};
    return AutomationAgentOsEvent.create(
      {
        companyId: input.companyId,
        moduleKey: input.moduleKey,
        eventName: input.eventName,
        entityId: input.entityId ?? null,
        payload: p,
        traceId:
          input.traceId ?? (p.traceId as string) ?? null,
        correlationId:
          input.correlationId ?? (p.correlationId as string) ?? null,
        sessionId: input.sessionId ?? (p.sessionId as string) ?? null,
        executionId:
          input.executionId ?? (p.executionId as string) ?? null,
        severity: input.severity ?? (p.severity as string) ?? null,
        origin: input.origin ?? (p.origin as string) ?? null
      } as any,
      { transaction }
    );
  }

  writeEventFireAndForget(input: Parameters<ObservabilityRepository["writeEvent"]>[0]) {
    persistAsync(() => this.writeEvent(input), "event");
  }

  async upsertMetric(
    input: {
      companyId: number;
      moduleKey: string;
      metricKey: string;
      metricValue: number;
      dimensions?: Record<string, unknown> | null;
      periodStart?: Date | null;
      periodEnd?: Date | null;
    },
    transaction?: Transaction
  ) {
    assertCompanyId(input.companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return null;
    const periodStart = input.periodStart || new Date();
    const existing = await AutomationAgentOsMetric.findOne({
      where: {
        companyId: input.companyId,
        moduleKey: input.moduleKey,
        metricKey: input.metricKey,
        periodStart
      },
      transaction
    });
    if (existing) {
      await existing.update(
        {
          metricValue: input.metricValue,
          dimensions: input.dimensions ?? existing.dimensions,
          periodEnd: input.periodEnd ?? existing.periodEnd
        },
        { transaction }
      );
      return existing;
    }
    return AutomationAgentOsMetric.create(
      {
        companyId: input.companyId,
        moduleKey: input.moduleKey,
        metricKey: input.metricKey,
        metricValue: input.metricValue,
        dimensions: input.dimensions ?? null,
        periodStart,
        periodEnd: input.periodEnd ?? null
      } as any,
      { transaction }
    );
  }

  upsertMetricFireAndForget(
    input: Parameters<ObservabilityRepository["upsertMetric"]>[0]
  ) {
    persistAsync(() => this.upsertMetric(input), "metric");
  }

  async saveReplay(
    input: {
      id: string;
      companyId: number;
      moduleKey: string;
      sourceId?: string | null;
      sessionId?: string | null;
      agentId?: string | null;
      payload: Record<string, unknown>;
    },
    transaction?: Transaction
  ) {
    assertCompanyId(input.companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return input;
    await AutomationAgentOsReplay.upsert(
      {
        id: input.id,
        companyId: input.companyId,
        moduleKey: input.moduleKey,
        sourceId: input.sourceId ?? null,
        sessionId: input.sessionId ?? null,
        agentId: input.agentId ?? null,
        payload: input.payload
      } as any,
      { transaction }
    );
    return input;
  }

  saveReplayFireAndForget(
    input: Parameters<ObservabilityRepository["saveReplay"]>[0]
  ) {
    persistAsync(() => this.saveReplay(input), "replay");
  }

  async getReplay(companyId: number, id: string) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return null;
    return AutomationAgentOsReplay.findOne({ where: { companyId, id } });
  }

  async getSetting(companyId: number, moduleKey: string) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return null;
    return AutomationAgentOsSetting.findOne({ where: { companyId, moduleKey } });
  }

  async putSetting(
    companyId: number,
    moduleKey: string,
    config: Record<string, unknown>,
    updatedBy?: number | null,
    transaction?: Transaction
  ) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return config;
    const existing = await AutomationAgentOsSetting.findOne({
      where: { companyId, moduleKey },
      transaction
    });
    if (existing) {
      await existing.update(
        {
          config,
          version: existing.version + 1,
          updatedBy: updatedBy ?? existing.updatedBy
        },
        { transaction }
      );
      return existing.config;
    }
    await AutomationAgentOsSetting.create(
      {
        companyId,
        moduleKey,
        config,
        version: 1,
        updatedBy: updatedBy ?? null
      } as any,
      { transaction }
    );
    return config;
  }

  putSettingFireAndForget(
    companyId: number,
    moduleKey: string,
    config: Record<string, unknown>,
    updatedBy?: number | null
  ) {
    persistAsync(
      () => this.putSetting(companyId, moduleKey, config, updatedBy),
      `settings.${moduleKey}`
    );
  }

  async claimIdempotency(
    companyId: number,
    idempotencyKey: string,
    entityType: string,
    entityId: string,
    ttlMs = AGENTOS_RETENTION_DAYS.idempotency * 86400000
  ): Promise<string | null> {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return null;
    const existing = await AutomationAgentOsIdempotency.findOne({
      where: { companyId, idempotencyKey }
    });
    if (existing) return existing.entityId;
    await AutomationAgentOsIdempotency.create({
      companyId,
      idempotencyKey,
      entityType,
      entityId,
      expiresAt: new Date(Date.now() + ttlMs)
    } as any);
    return null;
  }

  async purgeExpired(companyId?: number) {
    if (getAgentOsPersistenceBackend() !== "sequelize") return { deleted: 0 };
    const where: any = { expiresAt: { [Op.lt]: new Date() } };
    if (companyId != null) where.companyId = assertCompanyId(companyId);
    const deleted = await AutomationAgentOsIdempotency.destroy({ where });
    return { deleted };
  }
}

export const observabilityRepository = new ObservabilityRepository();
export default observabilityRepository;
