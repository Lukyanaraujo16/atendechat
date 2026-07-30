import { Op } from "sequelize";
import { Request } from "express";
import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import AiKnowledgeEmbeddingSettings from "../../models/AiKnowledgeEmbeddingSettings";
import AiProviderCredential from "../../models/AiProviderCredential";
import Whatsapp from "../../models/Whatsapp";
import {
  assertAiAgentProductConfigurationAccess
} from "./aiAgentProductConfigurationHelpers";
import {
  isAiAgentProductSupportedProvider,
  isAiProviderId,
  parseCommercialProvider
} from "./aiAgentProductProviderCapabilities";
import type { AiProviderId } from "../../config/aiProviderModels";

/**
 * Campos estruturais / internos que a Product Credential API não aceita no body.
 * `enabled` só via POST .../enable e .../disable.
 */
export const FORBIDDEN_BODY_KEYS = [
  "id",
  "credentialId",
  "aiProviderCredentialId",
  "companyId",
  "apiKeyEncrypted",
  "apiKeyMasked",
  "maskedKey",
  "enabled"
] as const;

/** Modos WhatsApp que tornam o agente "ativo" para bloqueio de disable. */
export const ACTIVE_AI_AGENT_WHATSAPP_MODES = [
  "shadow",
  "live",
  "dry_run"
] as const;

/** Ref opaca alinhada a Options (`ref: String(c.id)`). */
export function encodeCredentialRef(id: number): string {
  return String(id);
}

/**
 * Valida credentialRef como inteiro positivo em string.
 * Formato inválido → 400; não faz lookup de tenant aqui.
 */
export function parseCredentialRef(ref: unknown): number {
  if (ref === undefined || ref === null) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      400,
      "Referência de credencial inválida."
    );
  }
  const raw = String(ref).trim();
  if (!/^\d+$/.test(raw)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      400,
      "Referência de credencial inválida."
    );
  }
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      400,
      "Referência de credencial inválida."
    );
  }
  return id;
}

export function rejectForbiddenCredentialFields(
  body: Record<string, unknown> | null | undefined
): void {
  const src = body || {};
  for (const key of FORBIDDEN_BODY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        403,
        "Contexto da empresa inválido."
      );
    }
  }
}

/**
 * Valida provider contra a allowlist comercial (openai + gemini).
 */
export function assertProductCredentialProvider(
  provider: unknown
): AiProviderId {
  if (provider === undefined || provider === null || String(provider).trim() === "") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_PROVIDER_INVALID",
      400,
      "Provedor inválido ou não suportado."
    );
  }
  const value = String(provider).trim().toLowerCase();
  if (!isAiProviderId(value) || !isAiAgentProductSupportedProvider(value)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_PROVIDER_INVALID",
      400,
      "Provedor inválido ou não suportado."
    );
  }
  return parseCommercialProvider(value);
}

export async function assertAiAgentProductCredentialAccess(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<{ enabledByPlan: boolean; accessibleByUser: boolean }> {
  return assertAiAgentProductConfigurationAccess(input);
}

export async function findAiAgentProductCredentialOrThrow(
  companyId: number,
  credentialId: number
): Promise<AiProviderCredential> {
  const row = await AiProviderCredential.findOne({
    where: { id: credentialId, companyId }
  });
  if (!row) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      404,
      "Credencial não encontrada."
    );
  }
  return row;
}

/**
 * AiAgent não persiste `provider` — se a credencial estiver vinculada a
 * qualquer agente do tenant, rejeita troca de provider (regra conservadora).
 */
export async function assertProviderChangeAllowed(input: {
  companyId: number;
  credentialId: number;
  currentProvider: string;
  nextProvider: string;
}): Promise<void> {
  const current = String(input.currentProvider || "")
    .trim()
    .toLowerCase();
  const next = String(input.nextProvider || "")
    .trim()
    .toLowerCase();
  if (current === next) return;

  const linkedCount = await AiAgent.count({
    where: {
      companyId: input.companyId,
      aiProviderCredentialId: input.credentialId
    }
  });
  if (linkedCount > 0) {
    throw new AppError(
      "ERR_AI_AGENT_CREDENTIAL_PROVIDER_IN_USE",
      400,
      "Não é possível alterar o provedor de uma credencial vinculada a um agente."
    );
  }
}

/**
 * Bloqueia disable se KB embedding usa a credencial, ou se alguma conexão
 * WhatsApp vinculada está em shadow|live|dry_run (operação ativa).
 *
 * Agente Off (todas as conexões Off) → permite, mesmo se AiAgent.enabled=true.
 * O flag enabled do agente sozinho não bloqueia.
 */
export async function assertCredentialDisableAllowed(input: {
  companyId: number;
  credentialId: number;
}): Promise<void> {
  const { companyId, credentialId } = input;

  const kbCount = await AiKnowledgeEmbeddingSettings.count({
    where: { companyId, credentialId }
  });
  if (kbCount > 0) {
    throw new AppError(
      "ERR_AI_AGENT_CREDENTIAL_KNOWLEDGE_IN_USE",
      400,
      "Não é possível desativar uma credencial em uso pela base de conhecimento."
    );
  }

  const agents = await AiAgent.findAll({
    where: {
      companyId,
      aiProviderCredentialId: credentialId
    },
    attributes: ["id", "enabled"]
  });

  if (agents.length === 0) return;

  const agentIds = agents.map(a => a.id);
  const activeWa = await Whatsapp.count({
    where: {
      companyId,
      aiAgentId: { [Op.in]: agentIds },
      aiAgentMode: { [Op.in]: [...ACTIVE_AI_AGENT_WHATSAPP_MODES] }
    }
  });
  if (activeWa > 0) {
    throw new AppError(
      "ERR_AI_AGENT_CREDENTIAL_ACTIVE_AGENT_IN_USE",
      400,
      "Não é possível desativar uma credencial vinculada a um agente em operação."
    );
  }
}
