import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import AiAgentProfile from "../../models/AiAgentProfile";
import AiProviderCredential from "../../models/AiProviderCredential";
import Whatsapp from "../../models/Whatsapp";
import { loadCompanyPlanContextByCompanyId } from "../../middleware/loadCompanyEffectiveFeatures";
import { computeEffectiveUserFeatureMapForRequest } from "../UserFeaturePermission/UserFeaturePermissionService";
import { Request } from "express";
import { resolveAiAgentBusinessPrompt } from "../AiAgentService/resolveAiAgentBusinessPrompt";
import { resolveWhatsappAiAgentRuntimeMode } from "../AiAgentService/aiAgentRuntimeMode";
import {
  AiAgentProductSnapshot,
  computeAiAgentProductReadiness
} from "./AgentReadinessService";
import {
  serializeAiAgentProductSummary,
  serializeAiAgentReadiness,
  serializeUnavailableProductSummary
} from "./serializeAiAgentProduct";
import {
  AiAgentProductReadiness,
  AiAgentProductSummary
} from "../../types/aiAgentProduct";

const FEATURE_KEY = "automation.ai_agent";

async function resolveHasProvider(
  companyId: number,
  agentCredentialId: number | null
): Promise<boolean> {
  if (agentCredentialId != null) {
    const linked = await AiProviderCredential.findOne({
      where: { id: agentCredentialId, companyId, enabled: true },
      attributes: ["id"]
    });
    if (linked) return true;
  }
  const companyDefault = await AiProviderCredential.findOne({
    where: { companyId, enabled: true, isDefault: true },
    attributes: ["id"]
  });
  if (companyDefault) return true;
  const anyEnabled = await AiProviderCredential.findOne({
    where: { companyId, enabled: true },
    attributes: ["id"],
    order: [["id", "ASC"]]
  });
  return !!anyEnabled;
}

function hasInstructions(
  agent: AiAgent,
  profile: AiAgentProfile | null
): boolean {
  const prompt = resolveAiAgentBusinessPrompt(agent, profile);
  return Boolean(prompt && String(prompt).trim());
}

export async function resolveAiAgentProductAvailability(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<{ enabledByPlan: boolean; accessibleByUser: boolean }> {
  if (input.availability) {
    return {
      enabledByPlan: input.availability.enabledByPlan === true,
      accessibleByUser: input.availability.accessibleByUser === true
    };
  }

  const ctx = await loadCompanyPlanContextByCompanyId(input.companyId);
  const enabledByPlan = ctx?.featureMap?.[FEATURE_KEY] === true;
  if (!enabledByPlan) {
    return { enabledByPlan: false, accessibleByUser: false };
  }
  if (!input.req) {
    return { enabledByPlan: true, accessibleByUser: true };
  }
  const merged = await computeEffectiveUserFeatureMapForRequest(
    input.req,
    ctx!.featureMap
  );
  return {
    enabledByPlan: true,
    accessibleByUser: merged[FEATURE_KEY] === true
  };
}

export async function buildAiAgentProductSnapshot(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductSnapshot> {
  const availability = await resolveAiAgentProductAvailability(input);

  const agents = await AiAgent.findAll({
    where: { companyId: input.companyId },
    order: [
      ["enabled", "DESC"],
      ["name", "ASC"]
    ],
    attributes: [
      "id",
      "name",
      "enabled",
      "aiProviderCredentialId",
      "systemPrompt",
      "companyId"
    ]
  });

  const profiles = await AiAgentProfile.findAll({
    where: { companyId: input.companyId },
    attributes: [
      "id",
      "aiAgentId",
      "setupMode",
      "generatedPrompt",
      "companyName",
      "attendantName"
    ]
  });
  const profileByAgent = new Map(profiles.map(p => [p.aiAgentId, p]));

  const agentSnapshots = [];
  for (const agent of agents) {
    const profile = profileByAgent.get(agent.id) || null;
    const hasProvider = await resolveHasProvider(
      input.companyId,
      agent.aiProviderCredentialId
    );
    agentSnapshots.push({
      id: agent.id,
      name: agent.name,
      enabled: agent.enabled === true,
      hasProvider,
      hasInstructions: hasInstructions(agent, profile),
      explicitlyPaused: false
    });
  }

  const connections = await Whatsapp.findAll({
    where: { companyId: input.companyId },
    attributes: [
      "id",
      "name",
      "status",
      "aiAgentId",
      "aiAgentMode",
      "aiAgentEnabled",
      "companyId"
    ]
  });

  return {
    enabledByPlan: availability.enabledByPlan,
    accessibleByUser: availability.accessibleByUser,
    agents: agentSnapshots,
    connections: connections.map(w => ({
      id: w.id,
      name: w.name,
      status: w.status,
      aiAgentId: w.aiAgentId,
      runtimeMode: resolveWhatsappAiAgentRuntimeMode(w)
    }))
  };
}

function assertCommercialAccess(availability: {
  enabledByPlan: boolean;
  accessibleByUser: boolean;
}): void {
  // Plano off → summary reduzido (unavailable), não 403
  // User feature off com plano on → 403 (Estratégia A, alinhado ao bloqueio do módulo)
  if (availability.enabledByPlan && !availability.accessibleByUser) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
      403,
      "Acesso ao Agente de IA não permitido para este usuário."
    );
  }
}

export default async function GetAiAgentProductSummaryService(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductSummary> {
  if (input.companyId == null || !Number.isFinite(Number(input.companyId))) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      403,
      "Contexto da empresa inválido."
    );
  }

  const companyId = Number(input.companyId);
  const availability = await resolveAiAgentProductAvailability({
    companyId,
    req: input.req,
    availability: input.availability
  });

  assertCommercialAccess(availability);

  if (!availability.enabledByPlan) {
    return serializeUnavailableProductSummary({
      enabledByPlan: false,
      accessibleByUser: false
    });
  }

  const snapshot = await buildAiAgentProductSnapshot({
    companyId,
    req: input.req,
    availability
  });

  const computed = computeAiAgentProductReadiness(snapshot);
  const { readiness, agent, linkedConnections, primaryConnection } = computed;

  const summary: AiAgentProductSummary = {
    availability: {
      enabledByPlan: snapshot.enabledByPlan,
      accessibleByUser: snapshot.accessibleByUser
    },
    status: readiness.status,
    mode: readiness.mode,
    agent: agent
      ? {
          exists: true,
          id: agent.id,
          name: agent.name,
          enabled: agent.enabled
        }
      : { exists: false },
    connection: {
      linked: linkedConnections.length > 0,
      ...(linkedConnections.length > 0 && primaryConnection
        ? {
            name: primaryConnection.name,
            connected:
              String(primaryConnection.status || "").toUpperCase() ===
              "CONNECTED"
          }
        : {})
    },
    readiness
  };

  return serializeAiAgentProductSummary(summary);
}

export async function GetAiAgentProductReadinessService(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<{
  availability: AiAgentProductSummary["availability"];
  status: AiAgentProductSummary["status"];
  mode: AiAgentProductSummary["mode"];
  readiness: AiAgentProductReadiness;
}> {
  const summary = await GetAiAgentProductSummaryService(input);
  return {
    availability: summary.availability,
    status: summary.status,
    mode: summary.mode,
    readiness: serializeAiAgentReadiness(summary.readiness)
  };
}
