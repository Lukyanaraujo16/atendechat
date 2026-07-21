import Setting from "../../../models/Setting";
import Whatsapp from "../../../models/Whatsapp";
import AiAgent from "../../../models/AiAgent";
import AiAgentKnowledgeSettings from "../../../models/AiAgentKnowledgeSettings";
import AppError from "../../../errors/AppError";
import {
  DEFAULT_LIVE_ROLLOUT_CONFIG,
  LIVE_FC_COMPANY_SETTING_KEY,
  AUTOMATION_LIVE_ROLLOUT_VERSION
} from "../../../config/automationLiveRolloutConstants";
import {
  loadLiveRolloutConfig,
  saveLiveRolloutConfig,
  setKillSwitch,
  persistCompanyKillSwitch,
  getKillSwitchSnapshot,
  hydrateCompanyKillSwitch
} from "./LiveRolloutConfigService";
import { evaluateLiveEligibility } from "./AutomationEligibilityEngine";
import { evaluateCanary } from "./LiveCanary";
import {
  evaluateAndApplyAutoRollback,
  advanceProgressiveRolloutStep
} from "./LiveAutoRollback";
import { getLiveRolloutMetricsSnapshot } from "./LiveRolloutMetrics";
import { getEvidenceMetricsSnapshot } from "../evidence/EvidenceMetrics";
import {
  computeReadinessScore,
  loadEvidenceThresholds
} from "../evidence/EvidenceReadinessEngine";
import { decideRolloutAptitude } from "../evidence/RolloutDecisionService";

export async function GetLiveRolloutDashboardService(input: {
  companyId: number;
}) {
  await hydrateCompanyKillSwitch(input.companyId);
  const [config, companySetting, agentsOn, connectionsOn] = await Promise.all([
    loadLiveRolloutConfig(input.companyId),
    Setting.findOne({
      where: {
        companyId: input.companyId,
        key: LIVE_FC_COMPANY_SETTING_KEY
      }
    }),
    AiAgentKnowledgeSettings.count({
      where: { companyId: input.companyId, functionCallingLive: true }
    }),
    Whatsapp.count({
      where: { companyId: input.companyId, functionCallingLive: true }
    })
  ]);

  const metrics = getLiveRolloutMetricsSnapshot(input.companyId);
  const evidence = getEvidenceMetricsSnapshot(input.companyId);
  const thresholds = await loadEvidenceThresholds(input.companyId);
  const rates = {
    verificationRate: evidence.verificationRate,
    toolUtilizationRate: evidence.toolUtilizationRate,
    hallucinationRate: evidence.hallucinationRate,
    knowledgeUtilizationRate: evidence.knowledgeUtilizationRate,
    selectionAccuracy: evidence.selectionAccuracy,
    averageToolCalls: evidence.averageToolCalls,
    averageLatency: evidence.averageLatency,
    averageCost: evidence.averageCost,
    averageTokens: evidence.averageTokens,
    toolFailureRate: evidence.toolFailureRate,
    toolDeniedRate: evidence.toolDeniedRate,
    loopStopRate: evidence.loopStopRate,
    sampleCount: evidence.sampleCount
  };
  const readiness = computeReadinessScore(rates, thresholds);

  return {
    version: AUTOMATION_LIVE_ROLLOUT_VERSION,
    config,
    companyEnabled:
      companySetting?.value === "enabled" || companySetting?.value === "true",
    agentsEnabled: agentsOn,
    connectionsEnabled: connectionsOn,
    metrics,
    readiness,
    killSwitch: getKillSwitchSnapshot(input.companyId),
    comparison: {
      shadow: {
        verificationRate: evidence.verificationRate,
        hallucinationRate: evidence.hallucinationRate,
        averageLatency: evidence.averageLatency,
        averageCost: evidence.averageCost
      },
      live: {
        executions: metrics.liveExecutions,
        fallbacks: metrics.fallbacks,
        averageLatency: metrics.averageLatency,
        averageCost: metrics.averageCost,
        canaryRate: metrics.canaryRate
      }
    },
    writeToolsLiveEnabled: config.allowWriteToolsLive === true,
    note: "Write Tools permanecem desabilitadas por padrão."
  };
}

export async function GetLiveRolloutConfigService(input: {
  companyId: number;
}) {
  const config = await loadLiveRolloutConfig(input.companyId);
  return { config, defaults: DEFAULT_LIVE_ROLLOUT_CONFIG };
}

export async function UpsertLiveRolloutConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  const saved = await saveLiveRolloutConfig(input.companyId, input.config as any);
  return { config: saved };
}

export async function UpsertLiveFcCompanySettingService(input: {
  companyId: number;
  enabled: boolean;
}) {
  const value = input.enabled ? "enabled" : "disabled";
  const [row] = await Setting.findOrCreate({
    where: { companyId: input.companyId, key: LIVE_FC_COMPANY_SETTING_KEY },
    defaults: {
      companyId: input.companyId,
      key: LIVE_FC_COMPANY_SETTING_KEY,
      value
    }
  });
  await row.update({ value });
  return { key: LIVE_FC_COMPANY_SETTING_KEY, enabled: input.enabled };
}

export async function UpsertLiveFcAgentSettingService(input: {
  companyId: number;
  aiAgentId: number;
  enabled: boolean;
  userId?: number | null;
}) {
  const [row] = await AiAgentKnowledgeSettings.findOrCreate({
    where: { companyId: input.companyId, aiAgentId: input.aiAgentId },
    defaults: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      enabled: false,
      functionCallingLive: false,
      updatedBy: input.userId ?? null,
      createdBy: input.userId ?? null
    }
  });
  await row.update({
    functionCallingLive: input.enabled === true,
    updatedBy: input.userId ?? row.updatedBy
  });
  return { functionCallingLive: row.functionCallingLive === true };
}

export async function UpsertLiveFcConnectionSettingService(input: {
  companyId: number;
  whatsappId: number;
  enabled: boolean;
}) {
  const wa = await Whatsapp.findOne({
    where: { id: input.whatsappId, companyId: input.companyId }
  });
  if (!wa) throw new AppError("ERR_NO_PERMISSION", 404, "Conexão não encontrada.");
  await wa.update({ functionCallingLive: input.enabled === true });
  return { functionCallingLive: (wa as any).functionCallingLive === true };
}

export async function GetLiveReadinessService(input: { companyId: number }) {
  const evidence = getEvidenceMetricsSnapshot(input.companyId);
  const thresholds = await loadEvidenceThresholds(input.companyId);
  const rates = {
    verificationRate: evidence.verificationRate,
    toolUtilizationRate: evidence.toolUtilizationRate,
    hallucinationRate: evidence.hallucinationRate,
    knowledgeUtilizationRate: evidence.knowledgeUtilizationRate,
    selectionAccuracy: evidence.selectionAccuracy,
    averageToolCalls: evidence.averageToolCalls,
    averageLatency: evidence.averageLatency,
    averageCost: evidence.averageCost,
    averageTokens: evidence.averageTokens,
    toolFailureRate: evidence.toolFailureRate,
    toolDeniedRate: evidence.toolDeniedRate,
    loopStopRate: evidence.loopStopRate,
    sampleCount: evidence.sampleCount
  };
  const readiness = computeReadinessScore(rates, thresholds);
  const decision = decideRolloutAptitude({
    companyId: input.companyId,
    rates,
    readiness,
    thresholds
  });
  const config = await loadLiveRolloutConfig(input.companyId);
  return {
    readiness,
    decision,
    config,
    /** Live FC só via estágio + toggles — não há botão global "ativar". */
    liveFunctionCallingViaRolloutOnly: true
  };
}

export async function TestLiveEligibilityService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  if (input.body?.adminTestMode !== true) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "adminTestMode obrigatório.");
  }
  const decision = await evaluateLiveEligibility({
    companyId: input.companyId,
    whatsappId: Number(input.body.whatsappId) || 1,
    aiAgentId: Number(input.body.aiAgentId) || 1,
    ticketId: Number(input.body.ticketId) || 1,
    messageId: (input.body.messageId as string) || "test-msg",
    provider: (input.body.provider as string) || "openai",
    message: (input.body.message as any) || {
      fromMe: false,
      mediaType: "chat",
      ticketStatus: "open",
      userId: null
    },
    skipReadiness: input.body.skipReadiness === true
  });
  const canary = evaluateCanary({
    stage: decision.stage as any,
    percent: decision.percent,
    companyId: input.companyId,
    ticketId: Number(input.body.ticketId) || 1,
    messageId: (input.body.messageId as string) || "test-msg"
  });
  return { decision, canary, writeToolsBlocked: true };
}

export async function ApplyLiveRollbackService(input: { companyId: number }) {
  return evaluateAndApplyAutoRollback({ companyId: input.companyId });
}

export async function ApplyLiveFallbackNoteService(input: {
  companyId: number;
  reason?: string;
}) {
  // Fallback é automático no runtime; endpoint documenta/força métrica
  const { recordLiveFcExecution } = await import("./LiveRolloutMetrics");
  recordLiveFcExecution({
    companyId: input.companyId,
    fallback: true,
    stage: "DISABLED"
  });
  return {
    ok: true,
    note: "Fallback legado é automático em falhas de FC. Métrica registrada.",
    reason: input.reason || "manual"
  };
}

export async function SetLiveKillSwitchService(input: {
  companyId: number;
  scope: string;
  targetId?: number | string;
  enabled: boolean;
}) {
  if (input.scope === "company") {
    await persistCompanyKillSwitch(input.companyId, input.enabled);
  } else {
    setKillSwitch({
      scope: input.scope as any,
      companyId: input.companyId,
      targetId: input.targetId,
      enabled: input.enabled
    });
  }
  return {
    ok: true,
    killSwitch: getKillSwitchSnapshot(input.companyId)
  };
}

export async function AdvanceProgressiveService(input: { companyId: number }) {
  return advanceProgressiveRolloutStep({ companyId: input.companyId });
}

export async function ListLiveRolloutTargetsService(input: {
  companyId: number;
}) {
  const [agents, connections] = await Promise.all([
    AiAgent.findAll({
      where: { companyId: input.companyId },
      attributes: ["id", "name"],
      limit: 100
    }),
    Whatsapp.findAll({
      where: { companyId: input.companyId },
      attributes: ["id", "name", "functionCallingLive"],
      limit: 100
    })
  ]);
  const settings = await AiAgentKnowledgeSettings.findAll({
    where: { companyId: input.companyId },
    attributes: ["aiAgentId", "functionCallingLive"]
  });
  const map = new Map(
    settings.map(s => [s.aiAgentId, s.functionCallingLive === true])
  );
  return {
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      functionCallingLive: map.get(a.id) === true
    })),
    connections: connections.map(c => ({
      id: c.id,
      name: c.name,
      functionCallingLive: (c as any).functionCallingLive === true
    }))
  };
}
