import { Request } from "express";
import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import AiProviderCredential from "../../models/AiProviderCredential";
import {
  AiAgentProductReadiness,
  AiAgentProductSimulatorUnavailableReason
} from "../../types/aiAgentProduct";
import {
  AiAgentProductProviderCompatibility,
  resolveAiAgentProductProviderCompatibility,
  resolveAiAgentProductProviderLabel
} from "./aiAgentProductProviderCapabilities";
import { assertAiAgentProductConfigurationAccess } from "./aiAgentProductConfigurationHelpers";
import {
  buildAiAgentProductSnapshot
} from "./GetAiAgentProductSummaryService";
import { computeAiAgentProductReadiness } from "./AgentReadinessService";
import { resolveAiAgentProductAgentContext } from "./ResolveAiAgentProductContextService";
import {
  resolveAiAgentProductAgentForOperation
} from "./aiAgentProductAgentRef";
import {
  scopeAiAgentProductSnapshotToAgent
} from "./ResolveAiAgentProductAgentService";

const SESSION_REF_PREFIX = "sim_s_";
const MESSAGE_REF_PREFIX = "sim_m_";

const FORBIDDEN_SIMULATOR_KEYS = ["companyId", "agentId", "aiAgentId"] as const;

export function encodeSimulatorSessionRef(id: number): string {
  return `${SESSION_REF_PREFIX}${Number(id)}`;
}

export function decodeSimulatorSessionRef(ref: unknown): number {
  const raw = String(ref ?? "").trim();
  if (!raw.startsWith(SESSION_REF_PREFIX)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_NOT_FOUND",
      404,
      "Sessão de simulação não encontrada."
    );
  }
  const id = Number(raw.slice(SESSION_REF_PREFIX.length));
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_NOT_FOUND",
      404,
      "Sessão de simulação não encontrada."
    );
  }
  return id;
}

export function encodeSimulatorMessageRef(id: number): string {
  return `${MESSAGE_REF_PREFIX}${Number(id)}`;
}

export function decodeSimulatorMessageRef(ref: unknown): number {
  const raw = String(ref ?? "").trim();
  if (!raw.startsWith(MESSAGE_REF_PREFIX)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_NOT_FOUND",
      404,
      "Mensagem de simulação não encontrada."
    );
  }
  const id = Number(raw.slice(MESSAGE_REF_PREFIX.length));
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_NOT_FOUND",
      404,
      "Mensagem de simulação não encontrada."
    );
  }
  return id;
}

/**
 * Rejeita ids técnicos no body/query/params da Product Simulator API.
 */
export function rejectProductSimulatorForbiddenIds(req: Request): void {
  const bags: Array<Record<string, unknown> | undefined> = [
    req.body as Record<string, unknown> | undefined,
    req.query as Record<string, unknown> | undefined,
    req.params as Record<string, unknown> | undefined
  ];
  for (const bag of bags) {
    if (!bag || typeof bag !== "object") continue;
    for (const key of FORBIDDEN_SIMULATOR_KEYS) {
      if (
        Object.prototype.hasOwnProperty.call(bag, key) &&
        bag[key] != null &&
        String(bag[key]).trim() !== ""
      ) {
        throw new AppError(
          "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
          403,
          "Contexto da empresa inválido."
        );
      }
    }
  }
}

/**
 * Credencial selecionada pelo agente (sem company_default).
 */
export async function resolveLinkedCredentialForSimulator(
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

export function mapProviderCompatibilityToSimulatorReason(
  compat: AiAgentProductProviderCompatibility | null | undefined
): AiAgentProductSimulatorUnavailableReason | null {
  if (!compat) return "simulator_not_configured";
  if (compat.ready === true) return null;

  if (compat.credentialStatus === "pending") {
    return "credential_not_selected";
  }
  if (
    compat.credentialStatus === "blocked" &&
    String(compat.credentialLabelKey || "").includes("credentialDisabled")
  ) {
    return "credential_disabled";
  }
  if (compat.providerStatus === "blocked") {
    return "provider_unsupported";
  }
  if (
    compat.credentialStatus === "blocked" &&
    String(compat.credentialLabelKey || "").includes("credentialIncompatible")
  ) {
    return "provider_unsupported";
  }
  if (compat.modelStatus === "blocked") {
    return "model_incompatible";
  }
  if (compat.credentialStatus === "blocked") {
    return "credential_disabled";
  }
  return "simulator_not_configured";
}

export type ProductSimulatorCapability = {
  available: boolean;
  reason: AiAgentProductSimulatorUnavailableReason | null;
  canSimulate: boolean;
  canReview: boolean;
  agentScope: ReturnType<typeof resolveAiAgentProductAgentContext>["agentScope"];
  resolution: ReturnType<typeof resolveAiAgentProductAgentContext>["resolution"];
  agentRow: AiAgent | null;
  readiness: AiAgentProductReadiness | null;
  providerLabel: string | null;
  modelLabel: string | null;
  providerCompatibility: AiAgentProductProviderCompatibility | null;
};

export async function resolveProductSimulatorCapability(
  companyId: number,
  req?: Request,
  agentRef?: unknown
): Promise<ProductSimulatorCapability> {
  await assertAiAgentProductConfigurationAccess({ companyId, req });

  const scoped = await resolveAiAgentProductAgentForOperation({
    companyId,
    agentRef
  });

  if (scoped.kind === "not_created") {
    return {
      available: false,
      reason: "not_created",
      canSimulate: false,
      canReview: false,
      agentScope: { type: "none", count: 0 },
      resolution: "not_created",
      agentRow: null,
      readiness: null,
      providerLabel: null,
      modelLabel: null,
      providerCompatibility: null
    };
  }

  const snapshotBase = await buildAiAgentProductSnapshot({ companyId, req });
  const snapshot = scopeAiAgentProductSnapshotToAgent(
    snapshotBase,
    scoped.agentId
  );
  const computed = computeAiAgentProductReadiness(snapshot);
  const { readiness, agent, agentScope, resolution } = computed;

  const agentRow = await AiAgent.findOne({
    where: { id: scoped.agentId, companyId }
  });
  if (!agentRow) {
    return {
      available: false,
      reason: "not_created",
      canSimulate: false,
      canReview: false,
      agentScope: { type: "none", count: 0 },
      resolution: "not_created",
      agentRow: null,
      readiness,
      providerLabel: null,
      modelLabel: null,
      providerCompatibility: null
    };
  }

  const linkedCredential = await resolveLinkedCredentialForSimulator(
    companyId,
    agentRow.aiProviderCredentialId
  );
  const providerCompatibility =
    agent?.providerCompatibility ||
    resolveAiAgentProductProviderCompatibility({
      model: agentRow.model,
      linkedCredential
    });

  const canSimulate = providerCompatibility.ready === true;
  const reason = mapProviderCompatibilityToSimulatorReason(
    providerCompatibility
  );
  const providerLabel = linkedCredential
    ? resolveAiAgentProductProviderLabel(linkedCredential.provider)
    : null;

  return {
    available: canSimulate,
    reason: canSimulate ? null : reason,
    canSimulate,
    canReview: canSimulate,
    agentScope,
    resolution,
    agentRow,
    readiness,
    providerLabel,
    modelLabel: agentRow.model ? String(agentRow.model) : null,
    providerCompatibility
  };
}

export async function assertProductSimulatorCanMutate(
  companyId: number,
  req?: Request,
  agentRef?: unknown
): Promise<ProductSimulatorCapability & { agentRow: AiAgent }> {
  const cap = await resolveProductSimulatorCapability(companyId, req, agentRef);

  if (cap.resolution === "not_created" || !cap.agentRow) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_UNAVAILABLE",
      400,
      "O simulador do Agente de IA não está disponível.",
      { reason: "not_created" }
    );
  }

  if (!cap.canSimulate) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_UNAVAILABLE",
      400,
      "O simulador do Agente de IA não está disponível.",
      { reason: cap.reason || "simulator_not_configured" }
    );
  }

  return cap as ProductSimulatorCapability & { agentRow: AiAgent };
}

export function mapLegacySimulatorError(err: unknown): never {
  if (err instanceof AppError) {
    const code = String(err.message || "");
    const map: Record<string, { code: string; status: number; msg: string }> = {
      ERR_AI_AGENT_SIMULATOR_SESSION_ENDED: {
        code: "ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_ENDED",
        status: 400,
        msg: "Esta sessão de simulação já foi encerrada."
      },
      ERR_AI_AGENT_SIMULATOR_MESSAGE_LIMIT: {
        code: "ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_LIMIT",
        status: 400,
        msg: "Limite de mensagens da sessão atingido."
      },
      ERR_AI_AGENT_SIMULATOR_USER_MESSAGE_LIMIT: {
        code: "ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_LIMIT",
        status: 400,
        msg: "Limite de mensagens do usuário atingido."
      },
      ERR_AI_AGENT_SIMULATOR_OPEN_SESSION_LIMIT: {
        code: "ERR_AI_AGENT_PRODUCT_SIMULATOR_OPEN_SESSION_LIMIT",
        status: 400,
        msg: "Encerre uma sessão ativa antes de iniciar outra simulação."
      },
      ERR_AI_AGENT_SIMULATOR_MISSING_CREDENTIAL: {
        code: "ERR_AI_AGENT_PRODUCT_SIMULATOR_UNAVAILABLE",
        status: 400,
        msg: "Configure uma credencial antes de simular."
      },
      ERR_AI_AGENT_SIMULATION_SESSION_NOT_FOUND: {
        code: "ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_NOT_FOUND",
        status: 404,
        msg: "Sessão de simulação não encontrada."
      },
      ERR_AI_AGENT_SIMULATION_MESSAGE_NOT_FOUND: {
        code: "ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_NOT_FOUND",
        status: 404,
        msg: "Mensagem de simulação não encontrada."
      }
    };
    const mapped = map[code];
    if (mapped) {
      throw new AppError(mapped.code, mapped.status, mapped.msg, err.data);
    }
    if (code.startsWith("ERR_AI_AGENT_PRODUCT_")) {
      throw err;
    }
    if (code === "ERR_VALIDATION_ERROR") {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_SIMULATOR_INVALID",
        err.statusCode || 400,
        err.clientMessage || "Dados inválidos para o simulador.",
        err.data
      );
    }
  }
  throw err;
}
