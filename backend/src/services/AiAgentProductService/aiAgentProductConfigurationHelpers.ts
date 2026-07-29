import { Request } from "express";
import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import AiAgentProfile from "../../models/AiAgentProfile";
import AiProviderCredential from "../../models/AiProviderCredential";
import Whatsapp from "../../models/Whatsapp";
import {
  AiAgentProductConfiguration,
  AiAgentProductConfigurationConnection
} from "../../types/aiAgentProduct";
import {
  DEFAULT_AI_AGENT_MAX_TOKENS,
  DEFAULT_AI_AGENT_MODEL,
  DEFAULT_AI_AGENT_TEMPERATURE
} from "../../config/aiAgentDefaults";
import { resolveAiAgentBusinessPrompt } from "../AiAgentService/resolveAiAgentBusinessPrompt";
import { resolveWhatsappAiAgentRuntimeMode } from "../AiAgentService/aiAgentRuntimeMode";
import { parseAiProviderCredentialId } from "../AiAgentService/parseAiProviderCredentialId";
import {
  normalizeOptionalString,
  parseRequiredName
} from "../AiAgentService/aiAgentTenant";
import {
  parseAiAgentMaxTokens,
  parseAiAgentModel,
  parseAiAgentTemperature
} from "../AiAgentService/aiAgentValidation";
import { resolveAiAgentProductAvailability } from "./GetAiAgentProductSummaryService";
import {
  assertModelCompatibleWithProvider,
  defaultModelForCommercialProvider,
  isAiAgentProductSupportedProvider,
  isAiProviderId,
  listAiAgentProductProviderOptions,
  parseCommercialModelForProvider,
  parseCommercialProvider,
  resolveCommercialProviderPresentation,
  resolveAiAgentProductProviderLabel
} from "./aiAgentProductProviderCapabilities";
import type { AiProviderId } from "../../config/aiProviderModels";

/** @deprecated Use listAiAgentProductProviderOptions — mantido como alias estável. */
export const AI_AGENT_PRODUCT_PROVIDER_OPTIONS =
  listAiAgentProductProviderOptions();

export const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini"
};

export {
  listAiAgentProductProviderOptions,
  parseCommercialProvider,
  parseCommercialModelForProvider,
  resolveAiAgentProductProviderLabel,
  isAiAgentProductSupportedProvider
};

/** Campos de identidade — editáveis mesmo com agente ativo. */
export const IDENTITY_FIELD_KEYS = [
  "name",
  "description",
  "fallbackMessage",
  "handoffMessage"
] as const;

/** Campos de modelo — estruturais. */
export const MODEL_FIELD_KEYS = ["model", "temperature", "maxTokens"] as const;

/** Campos comerciais do profile (instructions). */
export const PROFILE_FIELD_KEYS = [
  "companyName",
  "businessSegment",
  "customBusinessSegment",
  "departments",
  "attendantName",
  "attendantRole",
  "tone",
  "customTone",
  "clientAddressStyle",
  "emojiLevel",
  "responseLength",
  "allowedActions",
  "forbiddenActions",
  "handoffRules",
  "companyDescription",
  "productsAndServices",
  "serviceArea",
  "businessHours",
  "pricingPolicy",
  "negotiationPolicy",
  "schedulingPolicy",
  "frequentlyAskedQuestions",
  "importantInformation",
  "customInstructions",
  "sourceWebsite"
] as const;

const FORBIDDEN_BODY_KEYS = [
  "companyId",
  "agentId",
  "aiAgentId",
  "whatsappId",
  "enabled",
  "mode",
  "dry_run",
  "aiAgentEnabled",
  "aiAgentMode",
  "apiKey",
  "apiKeyEncrypted",
  "apiKeyMasked",
  "secret",
  "token",
  "platformPermissions",
  "systemPrompt",
  "generatedPrompt",
  "generatedPromptVersion",
  "generatedAt",
  "setupMode",
  "schemaVersion",
  "status",
  "readiness",
  "allowAudioInput",
  "allowAudioOutput"
];

const PREVIEW_MAX_CHARS = 200;

export function rejectForbiddenConfigurationFields(
  body: Record<string, unknown> | undefined
): void {
  if (!body || typeof body !== "object") return;
  for (const key of FORBIDDEN_BODY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] != null) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        403,
        "Campo não permitido na configuração comercial do Agente de IA."
      );
    }
  }
}

export async function assertAiAgentProductConfigurationAccess(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<{ enabledByPlan: boolean; accessibleByUser: boolean }> {
  if (input.companyId == null || !Number.isFinite(Number(input.companyId))) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      403,
      "Contexto da empresa inválido."
    );
  }

  const availability = await resolveAiAgentProductAvailability({
    companyId: Number(input.companyId),
    req: input.req,
    availability: input.availability
  });

  if (!availability.enabledByPlan) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      403,
      "O Agente de IA não está disponível no plano."
    );
  }
  if (!availability.accessibleByUser) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
      403,
      "Acesso ao Agente de IA não permitido para este usuário."
    );
  }
  return availability;
}

export function bodyHasAnyKey(
  body: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  return keys.some(k => Object.prototype.hasOwnProperty.call(body, k));
}

export function pickProfileFieldsFromBody(
  body: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PROFILE_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  return out;
}

export function profileFieldsFromExisting(
  profile: AiAgentProfile | null
): Record<string, unknown> {
  if (!profile) return {};
  const out: Record<string, unknown> = {};
  for (const key of PROFILE_FIELD_KEYS) {
    out[key] = (profile as unknown as Record<string, unknown>)[key];
  }
  return out;
}

export function buildInstructionsPreview(
  agent: Pick<AiAgent, "systemPrompt">,
  profile: Pick<AiAgentProfile, "generatedPrompt"> | null
): string | null {
  const source = String(
    profile?.generatedPrompt || agent.systemPrompt || ""
  ).trim();
  if (!source) return null;
  return source.length > PREVIEW_MAX_CHARS
    ? source.slice(0, PREVIEW_MAX_CHARS)
    : source;
}

export async function resolveEffectiveCredential(
  companyId: number,
  agentCredentialId: number | null,
  transaction?: Transaction
): Promise<AiProviderCredential | null> {
  const opts = transaction ? { transaction } : {};
  if (agentCredentialId != null) {
    const linked = await AiProviderCredential.findOne({
      where: { id: agentCredentialId, companyId },
      ...opts
    });
    if (linked) return linked;
  }
  const companyDefault = await AiProviderCredential.findOne({
    where: { companyId, enabled: true, isDefault: true },
    ...opts
  });
  if (companyDefault) return companyDefault;
  return AiProviderCredential.findOne({
    where: { companyId, enabled: true },
    order: [["id", "ASC"]],
    ...opts
  });
}

export function isAiAgentProductActive(
  agent: Pick<AiAgent, "enabled">,
  linked: Array<
    Pick<Whatsapp, "aiAgentMode" | "aiAgentEnabled" | "aiAgentId">
  >
): boolean {
  if (agent.enabled !== true) return false;
  return linked.some(w => resolveWhatsappAiAgentRuntimeMode(w) !== "disabled");
}

export function buildConfigurationConnections(
  linked: Array<Pick<Whatsapp, "id" | "name" | "status">>
): AiAgentProductConfigurationConnection[] {
  return linked
    .slice()
    .sort((a, b) => a.id - b.id)
    .map(w => ({
      ref: String(w.id),
      name: String(w.name || "").trim() || "—",
      status: String(w.status || ""),
      selected: true
    }));
}

export function buildAiAgentProductConfiguration(input: {
  agent: AiAgent;
  profile: AiAgentProfile | null;
  credential: AiProviderCredential | null;
  linkedWhatsapps: Whatsapp[];
}): AiAgentProductConfiguration {
  const { agent, profile, credential, linkedWhatsapps } = input;
  const prompt = resolveAiAgentBusinessPrompt(agent, profile);
  const providerPresentation = resolveCommercialProviderPresentation(
    credential ? String(credential.provider || "") : null
  );

  // Credencial comercial "configurada" só se habilitada + provider suportado
  const credentialCommerciallyOk =
    !!credential &&
    credential.enabled === true &&
    providerPresentation.supported === true;

  return {
    identity: {
      name: String(agent.name || ""),
      description: agent.description != null ? String(agent.description) : null
    },
    messages: {
      fallbackMessage:
        agent.fallbackMessage != null ? String(agent.fallbackMessage) : null,
      handoffMessage:
        agent.handoffMessage != null ? String(agent.handoffMessage) : null
    },
    model: {
      name: String(agent.model || DEFAULT_AI_AGENT_MODEL),
      temperature:
        agent.temperature != null
          ? Number(agent.temperature)
          : DEFAULT_AI_AGENT_TEMPERATURE,
      maxTokens:
        agent.maxTokens != null
          ? Number(agent.maxTokens)
          : DEFAULT_AI_AGENT_MAX_TOKENS
    },
    profile: profile ? profileFieldsFromExisting(profile) : null,
    instructions: {
      configured: Boolean(prompt && String(prompt).trim()),
      preview: buildInstructionsPreview(agent, profile)
    },
    provider: {
      configured: providerPresentation.configured && providerPresentation.supported,
      // Preserva valor persistido; nunca normaliza desconhecido → openai
      type: providerPresentation.type,
      label: providerPresentation.label
    },
    credential: {
      configured: credentialCommerciallyOk,
      label: credential ? String(credential.name || "") : null,
      maskedKey: credential ? String(credential.apiKeyMasked || "") : null
    },
    connections: buildConfigurationConnections(linkedWhatsapps)
  };
}

/**
 * Carrega credencial por ref e valida provider comercial + compatibilidade.
 */
export async function resolveCredentialForCommercialProvider(input: {
  companyId: number;
  credentialRef: unknown;
  expectedProvider?: AiProviderId | null;
}): Promise<{
  credentialId: number | null;
  provider: AiProviderId | null;
  credential: AiProviderCredential | null;
}> {
  const credentialId = await parseCredentialRef(
    input.companyId,
    input.credentialRef
  );
  if (credentialId == null) {
    return { credentialId: null, provider: null, credential: null };
  }

  const credential = await AiProviderCredential.findOne({
    where: { id: credentialId, companyId: input.companyId, enabled: true }
  });
  if (!credential) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      400,
      "Credencial inválida ou incompatível com a empresa."
    );
  }

  const credProvider = String(credential.provider || "")
    .trim()
    .toLowerCase();
  if (!isAiProviderId(credProvider)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      400,
      "Credencial com provedor não suportado."
    );
  }
  if (
    input.expectedProvider != null &&
    credProvider !== input.expectedProvider
  ) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      400,
      "Credencial incompatível com o provedor selecionado."
    );
  }

  return {
    credentialId,
    provider: credProvider,
    credential
  };
}

/**
 * Resolve provider efetivo + modelo + credencial a partir do body comercial.
 * Garante: provider ∈ allowlist, credential.provider === provider, model ∈ allowlist do provider.
 */
export async function resolveCommercialProviderCredentialModel(input: {
  companyId: number;
  body: Record<string, unknown>;
  current?: {
    model: string;
    aiProviderCredentialId: number | null;
  };
}): Promise<{
  provider: AiProviderId | null;
  credentialId: number | null | undefined;
  model: string | undefined;
  providerChanged: boolean;
  credentialChanged: boolean;
  modelChanged: boolean;
}> {
  const { body, current } = input;
  const hasProvider = Object.prototype.hasOwnProperty.call(body, "provider");
  const hasCredentialRef = Object.prototype.hasOwnProperty.call(
    body,
    "credentialRef"
  );
  const hasModel = Object.prototype.hasOwnProperty.call(body, "model");

  let requestedProvider: AiProviderId | null = null;
  if (hasProvider) {
    if (body.provider === null || body.provider === "") {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_PROVIDER_INVALID",
        400,
        "Provedor inválido ou não suportado."
      );
    }
    requestedProvider = parseCommercialProvider(body.provider);
  }

  let credentialId: number | null | undefined;
  let credentialProvider: AiProviderId | null = null;

  if (hasCredentialRef) {
    const resolved = await resolveCredentialForCommercialProvider({
      companyId: input.companyId,
      credentialRef: body.credentialRef,
      expectedProvider: requestedProvider
    });
    credentialId = resolved.credentialId;
    credentialProvider = resolved.provider;
  } else if (current?.aiProviderCredentialId != null) {
    const existing = await AiProviderCredential.findOne({
      where: {
        id: current.aiProviderCredentialId,
        companyId: input.companyId
      }
    });
    if (existing?.enabled === true) {
      const p = String(existing.provider || "")
        .trim()
        .toLowerCase();
      if (isAiProviderId(p)) {
        credentialProvider = p;
        credentialId = existing.id;
      }
    }
  }

  // Provider efetivo: explícito > credencial > null
  const effectiveProvider: AiProviderId | null =
    requestedProvider || credentialProvider;

  // Troca de provider sem nova credencial compatível → limpa credencial
  let providerChanged = false;
  if (
    requestedProvider != null &&
    credentialProvider != null &&
    credentialProvider !== requestedProvider
  ) {
    if (hasCredentialRef) {
      // Já validado em resolveCredentialForCommercialProvider
    } else {
      // Limpeza segura → setup_incomplete
      credentialId = null;
      credentialProvider = null;
      providerChanged = true;
    }
  }
  if (
    requestedProvider != null &&
    !hasCredentialRef &&
    current?.aiProviderCredentialId != null
  ) {
    const existing = await AiProviderCredential.findOne({
      where: {
        id: current.aiProviderCredentialId,
        companyId: input.companyId
      }
    });
    const existingProvider = String(existing?.provider || "")
      .trim()
      .toLowerCase();
    if (existingProvider !== requestedProvider) {
      credentialId = null;
      providerChanged = true;
    }
  }

  let model: string | undefined;
  if (effectiveProvider != null) {
    if (hasModel) {
      model = parseCommercialModelForProvider(body.model, effectiveProvider);
    } else if (current?.model) {
      if (isModelAllowedForProviderSafe(current.model, effectiveProvider)) {
        model = current.model;
      } else {
        // Modelo atual incompatível com novo provider → default seguro
        model = defaultModelForCommercialProvider(effectiveProvider);
        providerChanged = true;
      }
    } else if (hasProvider || hasCredentialRef) {
      model = defaultModelForCommercialProvider(effectiveProvider);
    }
  } else if (hasModel) {
    // Modelo sem provider/credencial: valida contra união global (legado)
    model = parseAiAgentModel(body.model);
  }

  const credentialChanged =
    hasCredentialRef ||
    (providerChanged && credentialId === null) ||
    (credentialId !== undefined &&
      current != null &&
      credentialId !== current.aiProviderCredentialId);

  const modelChanged =
    model !== undefined &&
    (current == null || model !== current.model);

  return {
    provider: effectiveProvider,
    credentialId: hasCredentialRef || providerChanged ? credentialId ?? null : credentialId,
    model,
    providerChanged: hasProvider || providerChanged,
    credentialChanged,
    modelChanged
  };
}

function isModelAllowedForProviderSafe(
  model: string,
  provider: AiProviderId
): boolean {
  try {
    assertModelCompatibleWithProvider(model, provider);
    return true;
  } catch {
    return false;
  }
}

export async function loadAiAgentProductConfigurationForAgent(input: {
  companyId: number;
  agentId: number;
  transaction?: Transaction;
}): Promise<AiAgentProductConfiguration> {
  const opts = input.transaction ? { transaction: input.transaction } : {};
  const agent = await AiAgent.findOne({
    where: { id: input.agentId, companyId: input.companyId },
    ...opts
  });
  if (!agent) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      409,
      "Agente de IA não encontrado."
    );
  }

  const profile = await AiAgentProfile.findOne({
    where: { companyId: input.companyId, aiAgentId: agent.id },
    ...opts
  });

  const linkedWhatsapps = await Whatsapp.findAll({
    where: { companyId: input.companyId, aiAgentId: agent.id },
    order: [["id", "ASC"]],
    ...opts
  });

  const credential =
    agent.aiProviderCredentialId != null
      ? await AiProviderCredential.findOne({
          where: {
            id: agent.aiProviderCredentialId,
            companyId: input.companyId
          },
          ...(input.transaction ? { transaction: input.transaction } : {})
        })
      : null;

  return buildAiAgentProductConfiguration({
    agent,
    profile,
    credential,
    linkedWhatsapps
  });
}

export async function parseCredentialRef(
  companyId: number,
  credentialRef: unknown
): Promise<number | null> {
  if (credentialRef === undefined) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "Referência de credencial inválida."
    );
  }
  if (credentialRef === null || credentialRef === "" || credentialRef === "null") {
    return null;
  }
  try {
    return await parseAiProviderCredentialId(companyId, credentialRef);
  } catch (err) {
    if (err instanceof AppError) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
        400,
        "Credencial inválida ou incompatível com a empresa."
      );
    }
    throw err;
  }
}

export function parseConnectionRefs(raw: unknown): string[] {
  if (raw === undefined) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "Lista de conexões inválida."
    );
  }
  if (!Array.isArray(raw)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "connectionRefs deve ser uma lista."
    );
  }
  const refs = raw.map(r => String(r).trim()).filter(Boolean);
  const unique = [...new Set(refs)];
  if (unique.length !== refs.length) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "connectionRefs contém duplicatas."
    );
  }
  return unique;
}

export async function resolveWhatsappsByRefs(input: {
  companyId: number;
  refs: string[];
  transaction?: Transaction;
}): Promise<Whatsapp[]> {
  if (input.refs.length === 0) return [];

  const ids: number[] = [];
  for (const ref of input.refs) {
    const id = Number(ref);
    if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONNECTION_INVALID",
        400,
        "Referência de conexão inválida."
      );
    }
    ids.push(id);
  }

  const opts = input.transaction
    ? { transaction: input.transaction, lock: Transaction.LOCK.UPDATE }
    : {};

  const rows = await Whatsapp.findAll({
    where: { companyId: input.companyId, id: ids },
    order: [["id", "ASC"]],
    ...opts
  });

  if (rows.length !== ids.length) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONNECTION_INVALID",
      400,
      "Conexão inexistente ou de outra empresa."
    );
  }

  const byId = new Map(rows.map(r => [r.id, r]));
  return ids.map(id => byId.get(id)!);
}

export function assertConnectionsAssignableToAgent(
  whatsapps: Whatsapp[],
  agentId: number
): void {
  for (const wa of whatsapps) {
    if (wa.aiAgentId != null && wa.aiAgentId !== agentId) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONNECTION_ALREADY_ASSIGNED",
        409,
        "Conexão já vinculada a outro Agente de IA."
      );
    }
  }
}

export function buildAgentCreatePatch(
  body: Record<string, unknown>,
  opts?: { model?: string }
): Record<string, unknown> {
  const name = parseRequiredName(body.name);
  const patch: Record<string, unknown> = {
    name,
    description: Object.prototype.hasOwnProperty.call(body, "description")
      ? normalizeOptionalString(body.description)
      : null,
    enabled: false,
    model:
      opts?.model != null
        ? opts.model
        : Object.prototype.hasOwnProperty.call(body, "model")
          ? parseAiAgentModel(body.model)
          : DEFAULT_AI_AGENT_MODEL,
    temperature: Object.prototype.hasOwnProperty.call(body, "temperature")
      ? parseAiAgentTemperature(body.temperature)
      : DEFAULT_AI_AGENT_TEMPERATURE,
    maxTokens: Object.prototype.hasOwnProperty.call(body, "maxTokens")
      ? parseAiAgentMaxTokens(body.maxTokens)
      : DEFAULT_AI_AGENT_MAX_TOKENS,
    fallbackMessage: Object.prototype.hasOwnProperty.call(body, "fallbackMessage")
      ? normalizeOptionalString(body.fallbackMessage)
      : null,
    handoffMessage: Object.prototype.hasOwnProperty.call(body, "handoffMessage")
      ? normalizeOptionalString(body.handoffMessage)
      : null,
    allowAudioInput: false,
    allowAudioOutput: false
  };
  return patch;
}

export function buildAgentUpdatePatch(
  body: Record<string, unknown>,
  current: AiAgent,
  opts?: { model?: string; skipModelFromBody?: boolean }
): { patch: Record<string, unknown>; changed: boolean } {
  const patch: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = parseRequiredName(body.name);
    if (name !== current.name) patch.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    const description = normalizeOptionalString(body.description);
    if (description !== (current.description ?? null)) {
      patch.description = description;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "fallbackMessage")) {
    const fallbackMessage = normalizeOptionalString(body.fallbackMessage);
    if (fallbackMessage !== (current.fallbackMessage ?? null)) {
      patch.fallbackMessage = fallbackMessage;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "handoffMessage")) {
    const handoffMessage = normalizeOptionalString(body.handoffMessage);
    if (handoffMessage !== (current.handoffMessage ?? null)) {
      patch.handoffMessage = handoffMessage;
    }
  }
  if (opts?.model != null) {
    if (opts.model !== current.model) patch.model = opts.model;
  } else if (
    !opts?.skipModelFromBody &&
    Object.prototype.hasOwnProperty.call(body, "model")
  ) {
    const model = parseAiAgentModel(body.model);
    if (model !== current.model) patch.model = model;
  }
  if (Object.prototype.hasOwnProperty.call(body, "temperature")) {
    const temperature = parseAiAgentTemperature(body.temperature);
    if (temperature !== Number(current.temperature)) {
      patch.temperature = temperature;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "maxTokens")) {
    const maxTokens = parseAiAgentMaxTokens(body.maxTokens);
    if (maxTokens !== Number(current.maxTokens)) {
      patch.maxTokens = maxTokens;
    }
  }

  return { patch, changed: Object.keys(patch).length > 0 };
}

export async function lockEligibleAgents(
  companyId: number,
  transaction: Transaction
): Promise<AiAgent[]> {
  return AiAgent.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    lock: Transaction.LOCK.UPDATE,
    transaction
  });
}
