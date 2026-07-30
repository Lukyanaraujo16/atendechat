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
  buildAiAgentProductConnectionScope
} from "./aiAgentProductConnectionScope";
import {
  AiAgentProductReadiness,
  AiAgentProductSummary
} from "../../types/aiAgentProduct";
import { resolveAiAgentProductProviderCompatibility } from "./aiAgentProductProviderCapabilities";
import {
  resolveAiAgentProductAgentForOperation
} from "./aiAgentProductAgentRef";
import {
  scopeAiAgentProductSnapshotToAgent
} from "./ResolveAiAgentProductAgentService";

const FEATURE_KEY = "automation.ai_agent";

/**
 * Resolve a credencial **selecionada** pelo agente (Hardening 2.3.2).
 * Sem fallback para default/qualquer enabled da empresa.
 * Cross-tenant / inexistente → null (sem revelar existência).
 */
async function resolveLinkedCredentialForReadiness(
  companyId: number,
  agentCredentialId: number | null
): Promise<{ provider: string; enabled: boolean } | null> {
  if (agentCredentialId == null) return null;
  const linked = await AiProviderCredential.findOne({
    where: { id: agentCredentialId, companyId },
    attributes: ["id", "provider", "enabled"]
  });
  if (!linked) return null;
  return {
    provider: String(linked.provider || ""),
    enabled: linked.enabled === true
  };
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
    order: [["id", "ASC"]],
    attributes: [
      "id",
      "name",
      "enabled",
      "model",
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
    const linkedCredential = await resolveLinkedCredentialForReadiness(
      input.companyId,
      agent.aiProviderCredentialId
    );
    const providerCompatibility = resolveAiAgentProductProviderCompatibility({
      model: agent.model,
      linkedCredential
    });
    agentSnapshots.push({
      id: agent.id,
      name: agent.name,
      enabled: agent.enabled === true,
      hasProvider: providerCompatibility.ready === true,
      hasInstructions: hasInstructions(agent, profile),
      explicitlyPaused: false,
      providerCompatibility
    });
  }

  const connections = await Whatsapp.findAll({
    where: { companyId: input.companyId },
    order: [["id", "ASC"]],
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
  agentRef?: unknown;
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

  const scoped = await resolveAiAgentProductAgentForOperation({
    companyId,
    agentRef: input.agentRef
  });

  const snapshotBase = await buildAiAgentProductSnapshot({
    companyId,
    req: input.req,
    availability
  });

  const snapshot =
    scoped.kind === "resolved"
      ? scopeAiAgentProductSnapshotToAgent(snapshotBase, scoped.agentId)
      : { ...snapshotBase, agents: [] };

  const computed = computeAiAgentProductReadiness(snapshot);
  const {
    readiness,
    agent,
    linkedConnections,
    primaryConnection,
    agentScope,
    resolution
  } = computed;

  const agentPayload =
    agent
      ? {
          exists: true as const,
          id: agent.id,
          name: agent.name,
          enabled: agent.enabled,
          ...(scoped.kind === "resolved"
            ? { agentRef: scoped.agentRef }
            : {})
        }
      : { exists: false as const };

  const summary: AiAgentProductSummary = {
    availability: {
      enabledByPlan: snapshot.enabledByPlan,
      accessibleByUser: snapshot.accessibleByUser
    },
    status: readiness.status,
    mode: readiness.mode,
    agent: agentPayload,
    connection:
      resolution === "resolved" && linkedConnections.length > 0
        ? {
            linked: true,
            ...(primaryConnection
              ? {
                  name: primaryConnection.name,
                  connected:
                    String(primaryConnection.status || "").toUpperCase() ===
                    "CONNECTED"
                }
              : {})
          }
        : { linked: false },
    connectionScope:
      resolution === "resolved"
        ? buildAiAgentProductConnectionScope(linkedConnections)
        : {
            type: "all_linked",
            count: 0,
            connectedCount: 0,
            disconnectedCount: 0,
            names: []
          },
    agentScope,
    readiness
  };

  return serializeAiAgentProductSummary(summary);
}

export async function GetAiAgentProductReadinessService(input: {
  companyId: number;
  req?: Request;
  agentRef?: unknown;
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
