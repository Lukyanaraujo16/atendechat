/**
 * Fonte única da allowlist comercial de providers (Hardening 2.3.1).
 *
 * Reutiliza os IDs canônicos de `aiProviderModels` (runtime já suportado).
 * Não acopla o runtime Shadow/Live a esta constante — apenas a Product API.
 */
import {
  AI_PROVIDER_GEMINI,
  AI_PROVIDER_OPENAI,
  AiProviderId,
  DEFAULT_MODEL_BY_PROVIDER,
  getModelsForProvider,
  isAiProviderId,
  isModelAllowedForProvider,
  resolveDefaultModelForProvider
} from "../../config/aiProviderModels";
import AppError from "../../errors/AppError";
import type { AiAgentProductCheckStatus } from "../../types/aiAgentProduct";

export type AiAgentProductProviderCapability = {
  provider: AiProviderId;
  label: string;
  available: boolean;
  supportsShadow: boolean;
  supportsLive: boolean;
  requiresCredential: boolean;
  unavailableReason: string | null;
};

/**
 * Providers comerciais com runtime Shadow/Live/Simulator comprovado.
 * Ordem estável para options e testes.
 */
export const AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES: readonly AiAgentProductProviderCapability[] =
  [
    {
      provider: AI_PROVIDER_OPENAI,
      label: "OpenAI",
      available: true,
      supportsShadow: true,
      supportsLive: true,
      requiresCredential: true,
      unavailableReason: null
    },
    {
      provider: AI_PROVIDER_GEMINI,
      label: "Google Gemini",
      available: true,
      supportsShadow: true,
      supportsLive: true,
      requiresCredential: true,
      unavailableReason: null
    }
  ];

const LABEL_BY_PROVIDER: Record<AiProviderId, string> = {
  [AI_PROVIDER_OPENAI]: "OpenAI",
  [AI_PROVIDER_GEMINI]: "Google Gemini"
};

export function listAiAgentProductProviderOptions(): Array<{
  value: string;
  label: string;
  available: boolean;
  unavailableReason: string | null;
}> {
  return AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES.map(c => ({
    value: c.provider,
    label: c.label,
    available: c.available === true,
    unavailableReason: c.unavailableReason
  }));
}

export function isAiAgentProductSupportedProvider(
  value: string
): value is AiProviderId {
  return (
    isAiProviderId(value) &&
    AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES.some(
      c => c.provider === value && c.available === true
    )
  );
}

export function resolveAiAgentProductProviderLabel(
  provider: string | null | undefined
): string | null {
  if (provider == null || String(provider).trim() === "") return null;
  const normalized = String(provider).trim().toLowerCase();
  if (isAiProviderId(normalized)) {
    return LABEL_BY_PROVIDER[normalized];
  }
  // Provider persistido mas não suportado — não converter para OpenAI
  return "Não suportado";
}

/**
 * Representação comercial do provider na configuration.
 * Preserva o valor persistido; nunca normaliza desconhecido → openai.
 */
export function resolveCommercialProviderPresentation(
  providerRaw: string | null | undefined
): {
  configured: boolean;
  type: string | null;
  label: string | null;
  supported: boolean;
} {
  if (providerRaw == null || String(providerRaw).trim() === "") {
    return {
      configured: false,
      type: null,
      label: null,
      supported: false
    };
  }
  const type = String(providerRaw).trim().toLowerCase();
  const supported = isAiAgentProductSupportedProvider(type);
  return {
    configured: true,
    type,
    label: resolveAiAgentProductProviderLabel(type),
    supported
  };
}

export function parseCommercialProvider(
  raw: unknown
): AiProviderId {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_PROVIDER_INVALID",
      400,
      "Provedor inválido ou não suportado."
    );
  }
  const value = String(raw).trim().toLowerCase();
  if (!isAiAgentProductSupportedProvider(value)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_PROVIDER_INVALID",
      400,
      "Provedor inválido ou não suportado."
    );
  }
  return value;
}

/**
 * Valida modelo contra o provider efetivo.
 * Usa a allowlist real de `aiProviderModels` — sem inventar modelos.
 */
export function parseCommercialModelForProvider(
  modelRaw: unknown,
  provider: AiProviderId,
  opts?: { required?: boolean }
): string {
  const required = opts?.required === true;
  if (
    (modelRaw === undefined || modelRaw === null || String(modelRaw).trim() === "") &&
    !required
  ) {
    return resolveDefaultModelForProvider(provider);
  }
  const model = String(modelRaw).trim();
  if (!isModelAllowedForProvider(model, provider)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "Modelo incompatível com o provedor selecionado."
    );
  }
  return model;
}

export function assertModelCompatibleWithProvider(
  model: string,
  provider: AiProviderId
): void {
  if (!isModelAllowedForProvider(model, provider)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "Modelo incompatível com o provedor selecionado."
    );
  }
}

export function defaultModelForCommercialProvider(
  provider: AiProviderId
): string {
  return DEFAULT_MODEL_BY_PROVIDER[provider];
}

export function listModelsForCommercialProvider(
  provider: AiProviderId
): readonly string[] {
  return getModelsForProvider(provider);
}

/**
 * Snapshot comercial da credencial vinculada ao agente (já filtrada por companyId).
 * null = nenhuma referência / não encontrada no tenant (sem revelar cross-tenant).
 */
export type AiAgentProductLinkedCredentialSnapshot = {
  provider: string;
  enabled: boolean;
} | null;

export type AiAgentProductProviderCompatibility = {
  /** true somente quando provider + credencial + modelo estão prontos para ativar */
  ready: boolean;
  /** Conflito contraditório (atenção) vs mera ausência (setup incompleto) */
  hasConflict: boolean;
  providerStatus: AiAgentProductCheckStatus;
  credentialStatus: AiAgentProductCheckStatus;
  modelStatus: AiAgentProductCheckStatus;
  providerLabelKey: string;
  credentialLabelKey: string;
  modelLabelKey: string;
};

/**
 * Compatibilidade comercial provider/credencial/modelo (Hardening 2.3.2).
 *
 * Usa a credencial **selecionada** (`aiProviderCredentialId`), sem fallback
 * para outras credenciais da empresa. Runtime Shadow/Live ainda pode fazer
 * fallback — a Product API é mais estrita para liberar activate.
 *
 * - Ausente (null credential / empty model) → pending → setup_incomplete
 * - Contraditório (disabled / unknown / mismatch) → blocked → attention_required
 */
export function resolveAiAgentProductProviderCompatibility(input: {
  model: string | null | undefined;
  linkedCredential: AiAgentProductLinkedCredentialSnapshot;
}): AiAgentProductProviderCompatibility {
  const model = String(input.model || "").trim();
  const cred = input.linkedCredential;

  const base = {
    providerLabelKey: "aiAgentProduct.checks.provider",
    credentialLabelKey: "aiAgentProduct.checks.credential",
    modelLabelKey: "aiAgentProduct.checks.model"
  };

  // Sem credencial selecionada
  if (cred == null) {
    return {
      ready: false,
      hasConflict: false,
      providerStatus: "pending",
      credentialStatus: "pending",
      modelStatus: "pending",
      ...base
    };
  }

  const providerRaw = String(cred.provider || "")
    .trim()
    .toLowerCase();

  // Provider desconhecido / vazio na credencial
  if (!providerRaw || !isAiProviderId(providerRaw)) {
    return {
      ready: false,
      hasConflict: true,
      providerStatus: "blocked",
      credentialStatus: "blocked",
      modelStatus: !model ? "pending" : "blocked",
      providerLabelKey: "aiAgentProduct.checks.providerUnsupported",
      credentialLabelKey: "aiAgentProduct.checks.credentialIncompatible",
      modelLabelKey: model
        ? "aiAgentProduct.checks.modelIncompatible"
        : base.modelLabelKey
    };
  }

  if (!isAiAgentProductSupportedProvider(providerRaw)) {
    return {
      ready: false,
      hasConflict: true,
      providerStatus: "blocked",
      credentialStatus: "blocked",
      modelStatus: !model
        ? "pending"
        : isModelAllowedForProvider(model, providerRaw as AiProviderId)
          ? "complete"
          : "blocked",
      providerLabelKey: "aiAgentProduct.checks.providerUnsupported",
      credentialLabelKey: "aiAgentProduct.checks.credentialIncompatible",
      modelLabelKey: "aiAgentProduct.checks.modelIncompatible"
    };
  }

  // Credencial desabilitada — não usar outra da empresa
  if (cred.enabled !== true) {
    return {
      ready: false,
      hasConflict: true,
      providerStatus: "complete",
      credentialStatus: "blocked",
      modelStatus: !model
        ? "pending"
        : isModelAllowedForProvider(model, providerRaw)
          ? "complete"
          : "blocked",
      providerLabelKey: base.providerLabelKey,
      credentialLabelKey: "aiAgentProduct.checks.credentialDisabled",
      modelLabelKey: !model
        ? base.modelLabelKey
        : isModelAllowedForProvider(model, providerRaw)
          ? base.modelLabelKey
          : "aiAgentProduct.checks.modelIncompatible"
    };
  }

  // Credencial válida + provider suportado
  let modelStatus: AiAgentProductCheckStatus = "pending";
  let modelLabelKey = base.modelLabelKey;
  if (!model) {
    modelStatus = "pending";
  } else if (isModelAllowedForProvider(model, providerRaw)) {
    modelStatus = "complete";
  } else {
    modelStatus = "blocked";
    modelLabelKey = "aiAgentProduct.checks.modelIncompatible";
  }

  const ready =
    modelStatus === "complete"; /* provider+credential already ok */

  return {
    ready,
    hasConflict: modelStatus === "blocked",
    providerStatus: "complete",
    credentialStatus: "complete",
    modelStatus,
    providerLabelKey: base.providerLabelKey,
    credentialLabelKey: base.credentialLabelKey,
    modelLabelKey
  };
}

export {
  AI_PROVIDER_OPENAI,
  AI_PROVIDER_GEMINI,
  isAiProviderId,
  resolveDefaultModelForProvider
};
