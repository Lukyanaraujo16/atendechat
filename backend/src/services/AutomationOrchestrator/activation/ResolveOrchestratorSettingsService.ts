import {
  AUTOMATION_CONTROL_MODES,
  AUTOMATION_DEFAULT_CONTROL_MODE,
  AutomationControlMode
} from "../../../config/automationOrchestratorConstants";
import AppError from "../../../errors/AppError";
import AutomationOrchestratorSettings from "../../../models/AutomationOrchestratorSettings";
import { logger } from "../../../utils/logger";
import {
  CapabilityMap,
  getDefaultCapabilities,
  mergeCapabilities,
  validateCapabilityConsistency
} from "./capabilityPolicy";

export type ResolvedOrchestratorSettings = {
  id: number | null;
  companyId: number;
  whatsappId: number | null;
  aiAgentId: number | null;
  controlMode: AutomationControlMode;
  capabilities: CapabilityMap;
  enabled: boolean;
  circuitBreakerOpenUntil: Date | null;
  metadata: Record<string, unknown> | null;
  fromDefaults: boolean;
};

export type ResolveOrchestratorSettingsInput = {
  companyId: number;
  whatsappId?: number | null;
  aiAgentId?: number | null;
};

function isControlMode(value: unknown): value is AutomationControlMode {
  return (
    typeof value === "string" &&
    (AUTOMATION_CONTROL_MODES as readonly string[]).includes(value)
  );
}

function toResolved(
  companyId: number,
  row: AutomationOrchestratorSettings | null,
  scope: { whatsappId: number | null; aiAgentId: number | null }
): ResolvedOrchestratorSettings {
  if (!row) {
    return {
      id: null,
      companyId,
      whatsappId: scope.whatsappId,
      aiAgentId: scope.aiAgentId,
      controlMode: AUTOMATION_DEFAULT_CONTROL_MODE,
      capabilities: getDefaultCapabilities(),
      enabled: true,
      circuitBreakerOpenUntil: null,
      metadata: null,
      fromDefaults: true
    };
  }

  const controlMode = isControlMode(row.controlMode)
    ? row.controlMode
    : AUTOMATION_DEFAULT_CONTROL_MODE;

  return {
    id: row.id,
    companyId: row.companyId,
    whatsappId: row.whatsappId ?? null,
    aiAgentId: row.aiAgentId ?? null,
    controlMode,
    capabilities: mergeCapabilities(row.capabilities),
    enabled: row.enabled !== false,
    circuitBreakerOpenUntil: row.circuitBreakerOpenUntil ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    fromDefaults: false
  };
}

/**
 * Precedência: company+whatsapp+agent > company+whatsapp > company+null+null.
 */
export async function ResolveOrchestratorSettingsService(
  input: ResolveOrchestratorSettingsInput
): Promise<ResolvedOrchestratorSettings> {
  const companyId = input.companyId;
  const whatsappId =
    input.whatsappId != null && Number.isFinite(Number(input.whatsappId))
      ? Number(input.whatsappId)
      : null;
  const aiAgentId =
    input.aiAgentId != null && Number.isFinite(Number(input.aiAgentId))
      ? Number(input.aiAgentId)
      : null;

  try {
    const candidates = await AutomationOrchestratorSettings.findAll({
      where: { companyId },
      order: [["id", "ASC"]]
    });

    const exact =
      whatsappId != null && aiAgentId != null
        ? candidates.find(
            r =>
              Number(r.whatsappId) === whatsappId &&
              Number(r.aiAgentId) === aiAgentId
          )
        : null;

    const byWhatsapp =
      whatsappId != null
        ? candidates.find(
            r =>
              Number(r.whatsappId) === whatsappId &&
              (r.aiAgentId == null || r.aiAgentId === undefined)
          )
        : null;

    const companyWide = candidates.find(
      r =>
        (r.whatsappId == null || r.whatsappId === undefined) &&
        (r.aiAgentId == null || r.aiAgentId === undefined)
    );

    const chosen = exact || byWhatsapp || companyWide || null;
    return toResolved(companyId, chosen, { whatsappId, aiAgentId });
  } catch (err) {
    logger.warn(
      { err, companyId, whatsappId, aiAgentId },
      "[AutomationOrchestrator] ResolveOrchestratorSettingsService fail-open → defaults"
    );
    return toResolved(companyId, null, { whatsappId, aiAgentId });
  }
}

export type UpsertOrchestratorSettingsInput = {
  companyId: number;
  whatsappId?: number | null;
  aiAgentId?: number | null;
  controlMode?: AutomationControlMode;
  capabilities?: Partial<Record<string, string>> | null;
  enabled?: boolean;
  circuitBreakerOpenUntil?: Date | null;
  metadata?: Record<string, unknown> | null;
  updatedBy?: number | null;
};

export async function UpsertOrchestratorSettingsService(
  input: UpsertOrchestratorSettingsInput
): Promise<ResolvedOrchestratorSettings> {
  const whatsappId =
    input.whatsappId != null && Number.isFinite(Number(input.whatsappId))
      ? Number(input.whatsappId)
      : null;
  const aiAgentId =
    input.aiAgentId != null && Number.isFinite(Number(input.aiAgentId))
      ? Number(input.aiAgentId)
      : null;

  const controlMode = isControlMode(input.controlMode)
    ? input.controlMode
    : AUTOMATION_DEFAULT_CONTROL_MODE;
  const capabilities = mergeCapabilities(input.capabilities);
  validateCapabilityConsistency(controlMode, capabilities);

  const existing = await AutomationOrchestratorSettings.findOne({
    where: {
      companyId: input.companyId,
      whatsappId,
      aiAgentId
    }
  });

  const payload = {
    controlMode,
    capabilities,
    enabled: input.enabled !== false,
    circuitBreakerOpenUntil:
      input.circuitBreakerOpenUntil === undefined
        ? existing?.circuitBreakerOpenUntil ?? null
        : input.circuitBreakerOpenUntil,
    metadata: input.metadata ?? existing?.metadata ?? null,
    updatedBy: input.updatedBy ?? null
  };

  let row: AutomationOrchestratorSettings;
  if (existing) {
    await existing.update(payload);
    row = existing;
  } else {
    row = await AutomationOrchestratorSettings.create({
      companyId: input.companyId,
      whatsappId,
      aiAgentId,
      ...payload
    });
  }

  return toResolved(input.companyId, row, { whatsappId, aiAgentId });
}

export async function safeResolveOrchestratorSettings(
  input: ResolveOrchestratorSettingsInput
): Promise<ResolvedOrchestratorSettings> {
  try {
    return await ResolveOrchestratorSettingsService(input);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn(
      { err, companyId: input.companyId },
      "[AutomationOrchestrator] safeResolveOrchestratorSettings fail-open"
    );
    return toResolved(input.companyId, null, {
      whatsappId: input.whatsappId ?? null,
      aiAgentId: input.aiAgentId ?? null
    });
  }
}

export default ResolveOrchestratorSettingsService;
