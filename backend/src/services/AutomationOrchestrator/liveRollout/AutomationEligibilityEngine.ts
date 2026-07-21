import Setting from "../../../models/Setting";
import Whatsapp from "../../../models/Whatsapp";
import AiAgentKnowledgeSettings from "../../../models/AiAgentKnowledgeSettings";
import hasPlanFeature from "../../../helpers/hasPlanFeature";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../../../config/automationToolConstants";
import { AI_AGENT_PLAN_FEATURE_KEY } from "../../AiAgentService/resolveAiAgentWhatsappFields";
import {
  LIVE_FC_COMPANY_SETTING_KEY,
  LIVE_EXECUTABLE_STAGES,
  LiveMessagePolicy,
  LiveRolloutConfig
} from "../../../config/automationLiveRolloutConstants";
import {
  hydrateCompanyKillSwitch,
  isKillSwitchActive,
  loadLiveRolloutConfig,
  stageAllowsLiveExecution
} from "./LiveRolloutConfigService";
import { evaluateCanary } from "./LiveCanary";
import {
  computeReadinessScore,
  loadEvidenceThresholds
} from "../evidence/EvidenceReadinessEngine";
import { getEvidenceMetricsSnapshot } from "../evidence/EvidenceMetrics";
import { decideRolloutAptitude } from "../evidence/RolloutDecisionService";

export type EligibilityInput = {
  companyId: number;
  whatsappId: number;
  aiAgentId: number;
  ticketId: number;
  messageId?: string | null;
  provider?: string | null;
  /** Classificação inbound opcional. */
  message?: {
    fromMe?: boolean;
    mediaType?: string | null;
    body?: string | null;
    ticketStatus?: string | null;
    userId?: number | null;
    isFirstInbound?: boolean;
  } | null;
  /** Skip readiness DB (tester). */
  skipReadiness?: boolean;
};

export type EligibilityDecision = {
  eligible: boolean;
  stage: string;
  percent: number;
  canaryBucket: number;
  effectivePercent: number;
  allowWriteToolsLive: false | boolean;
  reasons: string[];
  blockers: string[];
  gates: Record<string, boolean>;
  killSwitch: { active: boolean; scope?: string; reason?: string };
  readinessLevel?: string;
  readinessScore?: number;
};

function checkMessagePolicy(
  policy: LiveMessagePolicy,
  message: EligibilityInput["message"]
): string[] {
  const blockers: string[] = [];
  if (!message) return blockers;

  if (policy.inboundOnly && message.fromMe === true) {
    blockers.push("message_outbound");
  }
  const media = String(message.mediaType || "chat").toLowerCase();
  if (policy.textOnly && media !== "chat" && media !== "text" && media !== "") {
    blockers.push("message_not_text");
  }
  if (policy.noAudio && (media === "audio" || media === "ptt")) {
    blockers.push("message_audio");
  }
  if (
    policy.noMedia &&
    ["image", "video", "document", "sticker", "application"].includes(media)
  ) {
    blockers.push("message_media");
  }
  if (policy.openTicketOnly) {
    const st = String(message.ticketStatus || "").toLowerCase();
    if (st && st !== "open" && st !== "pending") {
      blockers.push("ticket_not_open");
    }
  }
  if (policy.unassignedOnly && message.userId != null) {
    blockers.push("ticket_has_assignee");
  }
  if (policy.firstMessageOnly && message.isFirstInbound === false) {
    blockers.push("not_first_message");
  }
  return blockers;
}

/**
 * AutomationEligibilityEngine — decide se esta execução pode usar Live FC.
 * Nunca habilita Write Tools por padrão.
 */
export async function evaluateLiveEligibility(
  input: EligibilityInput
): Promise<EligibilityDecision> {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const gates: Record<string, boolean> = {};

  await hydrateCompanyKillSwitch(input.companyId);

  const kill = isKillSwitchActive({
    companyId: input.companyId,
    connectionId: input.whatsappId,
    agentId: input.aiAgentId,
    provider: input.provider
  });
  if (kill.active) {
    blockers.push(kill.reason || "kill_switch");
  }

  const [planAgent, planTools, companySetting, whatsapp, agentSettings, config] =
    await Promise.all([
      hasPlanFeature(input.companyId, AI_AGENT_PLAN_FEATURE_KEY),
      hasPlanFeature(input.companyId, AUTOMATION_AI_TOOLS_FEATURE_KEY),
      Setting.findOne({
        where: {
          companyId: input.companyId,
          key: LIVE_FC_COMPANY_SETTING_KEY
        }
      }),
      Whatsapp.findOne({
        where: { id: input.whatsappId, companyId: input.companyId },
        attributes: ["id", "functionCallingLive"]
      }),
      AiAgentKnowledgeSettings.findOne({
        where: {
          companyId: input.companyId,
          aiAgentId: input.aiAgentId
        },
        attributes: ["id", "functionCallingLive"]
      }),
      loadLiveRolloutConfig(input.companyId)
    ]);

  gates.planAgent = planAgent === true;
  gates.planTools = planTools === true;
  gates.companySetting =
    companySetting?.value === "enabled" || companySetting?.value === "true";
  gates.connection = (whatsapp as any)?.functionCallingLive === true;
  gates.agent = (agentSettings as any)?.functionCallingLive === true;
  gates.stageExecutable = stageAllowsLiveExecution(config.stage);

  if (!gates.planAgent) blockers.push("plan_agent_missing");
  if (!gates.planTools) blockers.push("plan_tools_missing");
  if (!gates.companySetting) blockers.push("company_disabled");
  if (!gates.connection) blockers.push("connection_disabled");
  if (!gates.agent) blockers.push("agent_disabled");
  if (!gates.stageExecutable) {
    blockers.push(`stage_${config.stage.toLowerCase()}`);
  }

  if (
    input.provider &&
    config.providersAllowed.length &&
    !config.providersAllowed.includes(input.provider as "openai" | "gemini")
  ) {
    blockers.push("provider_not_allowed");
    gates.provider = false;
  } else {
    gates.provider = true;
  }

  if (input.provider === "claude") {
    blockers.push("provider_claude_not_implemented");
    gates.provider = false;
  }

  const messageBlockers = checkMessagePolicy(
    config.messagePolicy,
    input.message
  );
  blockers.push(...messageBlockers);
  gates.messagePolicy = messageBlockers.length === 0;

  const canary = evaluateCanary({
    stage: config.stage,
    percent: config.percent,
    companyId: input.companyId,
    ticketId: input.ticketId,
    messageId: input.messageId,
    connectionId: input.whatsappId,
    agentId: input.aiAgentId
  });
  gates.canary = canary.eligible;
  if (!canary.eligible) blockers.push(canary.reason);

  let readinessLevel: string | undefined;
  let readinessScore: number | undefined;

  if (!input.skipReadiness && LIVE_EXECUTABLE_STAGES.includes(config.stage)) {
    const snap = getEvidenceMetricsSnapshot(input.companyId);
    const thresholds = await loadEvidenceThresholds(input.companyId);
    const rates = {
      verificationRate: snap.verificationRate,
      toolUtilizationRate: snap.toolUtilizationRate,
      hallucinationRate: snap.hallucinationRate,
      knowledgeUtilizationRate: snap.knowledgeUtilizationRate,
      selectionAccuracy: snap.selectionAccuracy,
      averageToolCalls: snap.averageToolCalls,
      averageLatency: snap.averageLatency,
      averageCost: snap.averageCost,
      averageTokens: snap.averageTokens,
      toolFailureRate: snap.toolFailureRate,
      toolDeniedRate: snap.toolDeniedRate,
      loopStopRate: snap.loopStopRate,
      sampleCount: snap.sampleCount
    };
    const readiness = computeReadinessScore(rates, thresholds);
    readinessLevel = readiness.level;
    readinessScore = readiness.score;
    const decision = decideRolloutAptitude({
      companyId: input.companyId,
      rates,
      readiness,
      thresholds,
      provider: input.provider
    });
    gates.readiness =
      decision.companyApt === true ||
      readiness.level === "READY" ||
      readiness.level === "PRODUCTION" ||
      readiness.level === "LIMITED";
    // Em CANARY inicial, permitir mesmo com poucas amostras se stage explícito
    if (
      !gates.readiness &&
      config.stage === "CANARY" &&
      rates.sampleCount < thresholds.minSamples
    ) {
      gates.readiness = true;
      reasons.push("canary_allows_low_samples");
    } else if (!gates.readiness) {
      blockers.push(`readiness_${readiness.level.toLowerCase()}`);
    }
    reasons.push(...decision.reasons.filter(r => !/desabilitado/i.test(r)));
  } else {
    gates.readiness = true;
  }

  const eligible = blockers.length === 0;

  return {
    eligible,
    stage: config.stage,
    percent: config.percent,
    canaryBucket: canary.bucket,
    effectivePercent: canary.effectivePercent,
    allowWriteToolsLive: config.allowWriteToolsLive === true,
    reasons,
    blockers: [...new Set(blockers)],
    gates,
    killSwitch: kill,
    readinessLevel,
    readinessScore
  };
}

export type { LiveRolloutConfig };
export default { evaluateLiveEligibility };
