import { DEFAULT_AI_AGENT_FORM } from "../../config/aiAgentFormDefaults";
import {
  normalizeAiAgentProductProvider,
} from "../../utils/aiAgentProductMapper";
import { createDefaultWizardFormState } from "./aiAgentWizardDefaults";
import {
  profileToWizardFormState,
  wizardFormStateToProfilePayload,
} from "./aiAgentWizardMappers";

function normalizeModel(model, fallbackProvider = null) {
  if (typeof model === "string") {
    return { value: model, label: model, provider: fallbackProvider };
  }
  const value = String(model?.value || model?.name || model?.id || "").trim();
  return {
    value,
    label: String(model?.label || model?.name || value).trim(),
    provider: normalizeAiAgentProductProvider(
      model?.provider || fallbackProvider
    ),
  };
}

function resolveIdentityName(formState) {
  return (
    String(formState.attendantName || formState.companyName || "").trim() ||
    "Atendente virtual"
  );
}

function resolveIdentityDescription(formState) {
  const companyName = String(formState.companyName || "").trim();
  return companyName ? `Atendente virtual — ${companyName}` : null;
}

export function mapAiAgentWizardProductOptions(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const providers = Array.isArray(source.providers)
    ? source.providers.map((provider) => ({
        value: normalizeAiAgentProductProvider(provider?.value),
        label: String(provider?.label || provider?.value || "").trim(),
        available: provider?.available === true,
        unavailableReason: provider?.unavailableReason || null,
      }))
    : [];

  const nestedModels = Array.isArray(source.providers)
    ? source.providers.flatMap((provider) =>
        (Array.isArray(provider?.models) ? provider.models : []).map((model) =>
          normalizeModel(model, provider.value)
        )
      )
    : [];
  const rootModels = Array.isArray(source.models)
    ? source.models.map((model) => normalizeModel(model))
    : [];

  return {
    providers: providers.filter((provider) => provider.value),
    models: [...rootModels, ...nestedModels].filter((model) => model.value),
    credentials: Array.isArray(source.credentials)
      ? source.credentials.map((credential) => ({
          ...credential,
          ref: String(credential?.ref || ""),
          provider: normalizeAiAgentProductProvider(credential?.provider),
          enabled: credential?.enabled === true,
        }))
      : [],
    connections: Array.isArray(source.connections)
      ? source.connections.map((connection) => ({
          ...connection,
          ref: String(connection?.ref || ""),
          selected: connection?.selected === true,
          eligible: connection?.eligible === true,
        }))
      : [],
  };
}

export function filterAiAgentWizardModelsByProvider(models, provider) {
  const normalized = normalizeAiAgentProductProvider(provider);
  return (models || []).filter((model) => model.provider === normalized);
}

export function filterAiAgentWizardCredentialsByProvider(
  credentials,
  provider
) {
  const normalized = normalizeAiAgentProductProvider(provider);
  return (credentials || []).filter(
    (credential) => credential.provider === normalized
  );
}

export function isAiAgentWizardScopeBlocked(agentScope) {
  return agentScope?.type === "ambiguous";
}

export function isAiAgentWizardActiveIdentityMode({
  isEditMode,
  editableWhileActive,
}) {
  return isEditMode === true && editableWhileActive === false;
}

export function aiAgentWizardIdentitySnapshot(formState) {
  return JSON.stringify({
    identityName: String(formState.identityName || ""),
    identityDescription: String(formState.identityDescription || ""),
    fallbackMessage: String(formState.fallbackMessage || ""),
    handoffMessage: String(formState.handoffMessage || ""),
  });
}

export function validateAiAgentWizardIdentity(formState) {
  const name = String(formState.identityName || "").trim();
  if (!name) return { identityName: "required" };
  if (name.length > 120) return { identityName: "tooLong" };
  return {};
}

/**
 * Valida provider/model/credential para create e edição estrutural (Off).
 * Não calcula readiness — apenas consistência comercial do formulário.
 * @returns {{ errorKey: string, field: string } | null}
 */
export function validateAiAgentWizardCommercialSetup(formState, rawOptions) {
  const options = mapAiAgentWizardProductOptions(rawOptions);
  const providerValue = String(formState.provider || "").trim();
  if (!providerValue) {
    return { errorKey: "providerRequired", field: "provider" };
  }

  const provider = options.providers.find((item) => item.value === providerValue);
  if (!provider || provider.available !== true) {
    return { errorKey: "providerUnsupported", field: "provider" };
  }

  const modelValue = String(formState.model || "").trim();
  if (!modelValue) {
    return { errorKey: "modelRequired", field: "model" };
  }

  const compatibleModels = filterAiAgentWizardModelsByProvider(
    options.models,
    providerValue
  );
  if (!compatibleModels.some((item) => item.value === modelValue)) {
    return { errorKey: "modelIncompatible", field: "model" };
  }

  const credentialRef = String(formState.credentialRef || "").trim();
  const compatibleCredentials = filterAiAgentWizardCredentialsByProvider(
    options.credentials,
    providerValue
  ).filter((item) => item.enabled === true);

  if (!compatibleCredentials.length) {
    return { errorKey: "credentialMissing", field: "credential" };
  }
  if (!credentialRef) {
    return { errorKey: "credentialRequired", field: "credential" };
  }
  if (!compatibleCredentials.some((item) => item.ref === credentialRef)) {
    return { errorKey: "credentialRequired", field: "credential" };
  }

  return null;
}

export function aiAgentProductConfigurationToWizardFormState(
  configuration,
  rawOptions
) {
  const config = configuration || {};
  const options = mapAiAgentWizardProductOptions(rawOptions);
  const profileState = config.profile
    ? profileToWizardFormState(config.profile)
    : createDefaultWizardFormState();
  const provider = normalizeAiAgentProductProvider(config.provider?.type) || "";
  const selectedCredential = options.credentials.find(
    (credential) =>
      credential.provider === provider &&
      credential.name === config.credential?.label &&
      credential.maskedKey === config.credential?.maskedKey
  );
  const configuredConnectionRefs = new Set(
    (config.connections || [])
      .filter((item) => item.selected)
      .map((item) => String(item.ref))
  );

  return {
    ...profileState,
    identityName: String(config.identity?.name || ""),
    identityDescription:
      config.identity?.description != null
        ? String(config.identity.description)
        : "",
    fallbackMessage:
      config.messages?.fallbackMessage != null
        ? String(config.messages.fallbackMessage)
        : profileState.fallbackMessage || "",
    handoffMessage:
      config.messages?.handoffMessage != null
        ? String(config.messages.handoffMessage)
        : profileState.handoffMessage || "",
    provider,
    model: String(config.model?.name || ""),
    credentialRef: selectedCredential?.ref || "",
    connectionRefs: options.connections
      .filter(
        (connection) =>
          connection.selected || configuredConnectionRefs.has(connection.ref)
      )
      .map((connection) => connection.ref),
  };
}

/** Allowlist comercial de identidade — seguro com agente ativo. */
export function wizardFormStateToProductIdentityPayload(formState) {
  return {
    name: String(formState.identityName || "").trim(),
    description:
      String(formState.identityDescription || "").trim() || null,
    fallbackMessage: String(formState.fallbackMessage || "").trim() || null,
    handoffMessage: String(formState.handoffMessage || "").trim() || null,
  };
}

export function wizardFormStateToProductConfigurationPayload(
  formState,
  { forCreate = false, includeConnections = false } = {}
) {
  const payload = {
    name: resolveIdentityName(formState),
    description: resolveIdentityDescription(formState),
    fallbackMessage: String(formState.fallbackMessage || "").trim() || null,
    handoffMessage: String(formState.handoffMessage || "").trim() || null,
    ...wizardFormStateToProfilePayload(formState),
  };

  if (forCreate) {
    if (payload.fallbackMessage == null) {
      payload.fallbackMessage = DEFAULT_AI_AGENT_FORM.fallbackMessage || null;
    }
    if (payload.handoffMessage == null) {
      payload.handoffMessage = DEFAULT_AI_AGENT_FORM.handoffMessage || null;
    }
  }
  if (formState.provider) payload.provider = formState.provider;
  if (formState.model) payload.model = formState.model;
  if (formState.credentialRef) payload.credentialRef = formState.credentialRef;
  if (includeConnections) {
    payload.connectionRefs = Array.isArray(formState.connectionRefs)
      ? formState.connectionRefs
      : [];
  }
  return payload;
}

export function wizardFormStateToProductConnectionsPayload(formState) {
  return {
    connectionRefs: Array.isArray(formState.connectionRefs)
      ? formState.connectionRefs
      : [],
  };
}
