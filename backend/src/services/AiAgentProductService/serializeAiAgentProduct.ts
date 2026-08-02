import {
  AiAgentProductReadiness,
  AiAgentProductSummary,
  AiAgentNextAction,
  AgentProductStatus,
  AiAgentProductMode,
  AiAgentProductCheck,
  AiAgentProductCommand,
  AiAgentProductCommandResult,
  AiAgentProductConnectionScope,
  AiAgentProductAffectedConnections,
  AiAgentProductAgentScope,
  AiAgentProductConfiguration,
  AiAgentProductConfigurationResult,
  AiAgentProductConfigurationView,
  AiAgentProductConfigurationOptions,
  AiAgentProductConfigurationConnection,
  AiAgentProductConfigurationPreview
} from "../../types/aiAgentProduct";
import { emptyConnectionScope } from "./aiAgentProductConnectionScope";
import { emptyAgentScope } from "./ResolveAiAgentProductContextService";
import { PROFILE_FIELD_KEYS } from "./aiAgentProductConfigurationHelpers";

const ALLOWED_SUMMARY_ROOT = new Set([
  "availability",
  "status",
  "mode",
  "agent",
  "connection",
  "connectionScope",
  "agentScope",
  "readiness"
]);

const ALLOWED_AVAILABILITY = new Set(["enabledByPlan", "accessibleByUser"]);
const ALLOWED_AGENT = new Set(["exists", "id", "agentRef", "name", "enabled"]);
const ALLOWED_CONNECTION = new Set(["linked", "name", "connected"]);
const ALLOWED_CONNECTION_SCOPE = new Set([
  "type",
  "count",
  "connectedCount",
  "disconnectedCount",
  "names"
]);
const ALLOWED_AGENT_SCOPE = new Set(["type", "count"]);
const ALLOWED_AFFECTED = new Set([
  "scope",
  "count",
  "names",
  "fromMode",
  "toMode"
]);
const ALLOWED_COMMAND_RESULT = new Set([
  "command",
  "changed",
  "affectedConnections",
  "summary"
]);
const ALLOWED_READINESS = new Set([
  "ready",
  "status",
  "mode",
  "nextAction",
  "checks",
  "mediaCapabilities"
]);
const ALLOWED_MEDIA_CAPABILITIES = new Set([
  "text",
  "vision",
  "audioTranscription",
  "reason"
]);
const ALLOWED_MEDIA_REASON = new Set(["vision", "audioTranscription"]);
const ALLOWED_CHECK = new Set(["key", "status", "labelKey"]);

const FORBIDDEN_KEY_FRAGMENTS = [
  "apikey",
  "apikeymasked",
  "credentialid",
  "systemprompt",
  "prompt",
  "providercredential",
  "trace",
  "metadata",
  "execution",
  "planning",
  "policy",
  "token",
  "secret",
  "companyid",
  "stack",
  "password",
  "whatsappid",
  "session"
];

function assertAllowlistedObject(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`Serializer leak: unexpected key ${path}.${key}`);
    }
    const lower = key.toLowerCase();
    for (const bad of FORBIDDEN_KEY_FRAGMENTS) {
      if (lower.includes(bad)) {
        throw new Error(`Serializer leak: forbidden key ${path}.${key}`);
      }
    }
  }
}

function serializeChecks(
  checks: AiAgentProductCheck[] | undefined
): AiAgentProductCheck[] {
  return (checks || []).map(c => {
    const row: AiAgentProductCheck = {
      key: c.key,
      status: c.status,
      labelKey: String(c.labelKey || "")
    };
    assertAllowlistedObject(
      row as unknown as Record<string, unknown>,
      ALLOWED_CHECK,
      "check"
    );
    return row;
  });
}

export function serializeAiAgentConnectionScope(
  scope: AiAgentProductConnectionScope | undefined
): AiAgentProductConnectionScope {
  const base = scope || emptyConnectionScope();
  const out: AiAgentProductConnectionScope = {
    type: "all_linked",
    count: Math.max(0, Number(base.count) || 0),
    connectedCount: Math.max(0, Number(base.connectedCount) || 0),
    disconnectedCount: Math.max(0, Number(base.disconnectedCount) || 0),
    names: Array.isArray(base.names)
      ? base.names.map(n => String(n || "").trim() || "—").slice(0, 50)
      : []
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_CONNECTION_SCOPE,
    "connectionScope"
  );
  return out;
}

export function serializeAiAgentAgentScope(
  scope: AiAgentProductAgentScope | undefined
): AiAgentProductAgentScope {
  const base = scope || emptyAgentScope();
  const type =
    base.type === "single" || base.type === "ambiguous" || base.type === "none"
      ? base.type
      : "none";
  const out: AiAgentProductAgentScope = {
    type,
    count: Math.max(0, Number(base.count) || 0)
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_AGENT_SCOPE,
    "agentScope"
  );
  return out;
}

export function serializeAffectedConnections(
  affected: AiAgentProductAffectedConnections
): AiAgentProductAffectedConnections {
  const out: AiAgentProductAffectedConnections = {
    scope: "all_linked",
    count: Math.max(0, Number(affected.count) || 0),
    names: Array.isArray(affected.names)
      ? affected.names.map(n => String(n || "").trim() || "—").slice(0, 50)
      : [],
    fromMode: affected.fromMode,
    toMode: affected.toMode
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_AFFECTED,
    "affectedConnections"
  );
  return out;
}

export function serializeAiAgentReadiness(
  readiness: AiAgentProductReadiness
): AiAgentProductReadiness {
  const media = readiness.mediaCapabilities;
  const out: AiAgentProductReadiness = {
    ready: readiness.ready === true,
    status: readiness.status,
    mode: readiness.mode,
    nextAction: readiness.nextAction,
    checks: serializeChecks(readiness.checks),
    ...(media
      ? {
          mediaCapabilities: {
            text: media.text,
            vision: media.vision,
            audioTranscription: media.audioTranscription,
            ...(media.reason
              ? {
                  reason: {
                    vision: media.reason.vision ?? null,
                    audioTranscription:
                      media.reason.audioTranscription ?? null
                  }
                }
              : {})
          }
        }
      : {})
  };
  if (out.mediaCapabilities) {
    assertAllowlistedObject(
      out.mediaCapabilities as unknown as Record<string, unknown>,
      ALLOWED_MEDIA_CAPABILITIES,
      "readiness.mediaCapabilities"
    );
    if (out.mediaCapabilities.reason) {
      assertAllowlistedObject(
        out.mediaCapabilities.reason as unknown as Record<string, unknown>,
        ALLOWED_MEDIA_REASON,
        "readiness.mediaCapabilities.reason"
      );
    }
  }
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_READINESS,
    "readiness"
  );
  return out;
}

export function serializeUnavailableProductSummary(input: {
  enabledByPlan: boolean;
  accessibleByUser: boolean;
  nextAction?: AiAgentNextAction;
}): AiAgentProductSummary {
  const status: AgentProductStatus = "unavailable";
  const mode: AiAgentProductMode = "off";
  const nextAction: AiAgentNextAction = input.nextAction || "upgrade_plan";
  return serializeAiAgentProductSummary({
    availability: {
      enabledByPlan: input.enabledByPlan === true,
      accessibleByUser: input.accessibleByUser === true
    },
    status,
    mode,
    agent: { exists: false },
    connection: { linked: false },
    connectionScope: emptyConnectionScope(),
    agentScope: emptyAgentScope(),
    readiness: {
      ready: false,
      status,
      mode,
      nextAction,
      checks: [
        {
          key: "plan",
          status: "blocked",
          labelKey: "aiAgentProduct.checks.plan"
        }
      ]
    }
  });
}

export function serializeAiAgentProductSummary(
  summary: AiAgentProductSummary
): AiAgentProductSummary {
  const agentExists = summary.agent?.exists === true;
  const out: AiAgentProductSummary = {
    availability: {
      enabledByPlan: summary.availability?.enabledByPlan === true,
      accessibleByUser: summary.availability?.accessibleByUser === true
    },
    status: summary.status,
    mode: summary.mode,
    agent: agentExists
      ? {
          exists: true,
          ...(summary.agent.id != null ? { id: Number(summary.agent.id) } : {}),
          ...(summary.agent.agentRef != null
            ? { agentRef: String(summary.agent.agentRef) }
            : summary.agent.id != null
              ? { agentRef: String(summary.agent.id) }
              : {}),
          ...(summary.agent.name != null
            ? { name: String(summary.agent.name) }
            : {}),
          // enabled só no preview single (com id); ambíguo não escolhe agente
          ...(summary.agent.id != null
            ? { enabled: summary.agent.enabled === true }
            : {})
        }
      : { exists: false },
    connection: {
      linked: summary.connection?.linked === true,
      ...(summary.connection?.linked
        ? {
            ...(summary.connection.name != null
              ? { name: String(summary.connection.name) }
              : {}),
            connected: summary.connection.connected === true
          }
        : {})
    },
    connectionScope: serializeAiAgentConnectionScope(summary.connectionScope),
    agentScope: serializeAiAgentAgentScope(summary.agentScope),
    readiness: serializeAiAgentReadiness(summary.readiness)
  };

  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_SUMMARY_ROOT,
    "summary"
  );
  assertAllowlistedObject(
    out.availability as unknown as Record<string, unknown>,
    ALLOWED_AVAILABILITY,
    "availability"
  );
  assertAllowlistedObject(
    out.agent as unknown as Record<string, unknown>,
    ALLOWED_AGENT,
    "agent"
  );
  assertAllowlistedObject(
    out.connection as unknown as Record<string, unknown>,
    ALLOWED_CONNECTION,
    "connection"
  );

  return out;
}

export function serializeAiAgentProductCommandResult(input: {
  command: AiAgentProductCommand;
  changed: boolean;
  affectedConnections: AiAgentProductAffectedConnections;
  summary: AiAgentProductSummary;
}): AiAgentProductCommandResult {
  const out: AiAgentProductCommandResult = {
    command: input.command,
    changed: input.changed === true,
    affectedConnections: serializeAffectedConnections(input.affectedConnections),
    summary: serializeAiAgentProductSummary(input.summary)
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_COMMAND_RESULT,
    "commandResult"
  );
  return out;
}

/** Lista de chaves raiz permitidas — para testes de contrato. */
export const AI_AGENT_PRODUCT_SUMMARY_ALLOWED_KEYS = [...ALLOWED_SUMMARY_ROOT];

const ALLOWED_CONFIGURATION_ROOT = new Set([
  "identity",
  "messages",
  "model",
  "profile",
  "instructions",
  "provider",
  "credential",
  "connections"
]);
const ALLOWED_CONFIGURATION_IDENTITY = new Set(["name", "description"]);
const ALLOWED_CONFIGURATION_MESSAGES = new Set([
  "fallbackMessage",
  "handoffMessage"
]);
const ALLOWED_CONFIGURATION_MODEL = new Set([
  "name",
  "temperature",
  "maxTokens"
]);
const ALLOWED_CONFIGURATION_PROFILE = new Set<string>(PROFILE_FIELD_KEYS);
const ALLOWED_CONFIGURATION_INSTRUCTIONS = new Set(["configured", "preview"]);
const ALLOWED_CONFIGURATION_PROVIDER = new Set([
  "configured",
  "type",
  "label"
]);
const ALLOWED_CONFIGURATION_CREDENTIAL = new Set([
  "configured",
  "label",
  "maskedKey"
]);
const ALLOWED_CONFIGURATION_CONNECTION = new Set([
  "ref",
  "name",
  "status",
  "selected"
]);
const ALLOWED_CONFIGURATION_VIEW = new Set([
  "agentScope",
  "agentRef",
  "configuration",
  "editableWhileActive",
  "summary"
]);
const ALLOWED_CONFIGURATION_RESULT = new Set([
  "changed",
  "created",
  "agentRef",
  "configuration",
  "summary"
]);
const ALLOWED_CONFIGURATION_OPTIONS = new Set([
  "providers",
  "models",
  "credentials",
  "connections"
]);
const ALLOWED_OPTIONS_PROVIDER = new Set([
  "value",
  "label",
  "available",
  "unavailableReason"
]);
const ALLOWED_OPTIONS_CREDENTIAL = new Set([
  "ref",
  "name",
  "provider",
  "maskedKey",
  "enabled",
  "isDefault"
]);
const ALLOWED_OPTIONS_MODEL = new Set([
  "value",
  "label",
  "provider",
  "supportsText",
  "supportsVision",
  "supportsAudioTranscription"
]);
const ALLOWED_OPTIONS_CONNECTION = new Set([
  "ref",
  "name",
  "status",
  "selected",
  "eligible",
  "ineligibleReason",
  "assignedAgentName",
  "assignedAgentRef"
]);

/**
 * Fragmentos proibidos na Configuration API.
 * Não inclui "token"/"prompt" genéricos — allowlist usa maxTokens e preview.
 */
const CONFIGURATION_FORBIDDEN_KEY_FRAGMENTS = [
  "apikeyencrypted",
  "apikey",
  "systemprompt",
  "generatedprompt",
  "credentialid",
  "companyid",
  "whatsappid",
  "aiagentid",
  "password",
  "secret",
  "stack",
  "session",
  "platformpermission",
  "trace",
  "execution",
  "planning"
];

function assertConfigurationAllowlisted(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`Serializer leak: unexpected key ${path}.${key}`);
    }
    const lower = key.toLowerCase();
    for (const bad of CONFIGURATION_FORBIDDEN_KEY_FRAGMENTS) {
      if (lower.includes(bad)) {
        throw new Error(`Serializer leak: forbidden key ${path}.${key}`);
      }
    }
  }
}

function serializeConfigurationConnection(
  row: AiAgentProductConfigurationConnection
): AiAgentProductConfigurationConnection {
  const out: AiAgentProductConfigurationConnection = {
    ref: String(row.ref),
    name: String(row.name || "").trim() || "—",
    status: String(row.status || ""),
    selected: row.selected === true
  };
  assertConfigurationAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_CONNECTION,
    "configuration.connections[]"
  );
  return out;
}

export function serializeAiAgentProductConfiguration(
  configuration: AiAgentProductConfiguration
): AiAgentProductConfiguration {
  const profile =
    configuration.profile == null
      ? null
      : PROFILE_FIELD_KEYS.reduce<Record<string, unknown>>((out, key) => {
          if (Object.prototype.hasOwnProperty.call(configuration.profile, key)) {
            out[key] = configuration.profile![key];
          }
          return out;
        }, {});
  const out: AiAgentProductConfiguration = {
    identity: {
      name: String(configuration.identity?.name || ""),
      description:
        configuration.identity?.description != null
          ? String(configuration.identity.description)
          : null
    },
    messages: {
      fallbackMessage:
        configuration.messages?.fallbackMessage != null
          ? String(configuration.messages.fallbackMessage)
          : null,
      handoffMessage:
        configuration.messages?.handoffMessage != null
          ? String(configuration.messages.handoffMessage)
          : null
    },
    model: {
      name: String(configuration.model?.name || ""),
      temperature: Number(configuration.model?.temperature),
      maxTokens: Number(configuration.model?.maxTokens)
    },
    profile,
    instructions: {
      configured: configuration.instructions?.configured === true,
      preview:
        configuration.instructions?.preview != null
          ? String(configuration.instructions.preview).slice(0, 200)
          : null
    },
    provider: {
      configured: configuration.provider?.configured === true,
      type:
        configuration.provider?.type != null
          ? String(configuration.provider.type)
          : null,
      label:
        configuration.provider?.label != null
          ? String(configuration.provider.label)
          : null
    },
    credential: {
      configured: configuration.credential?.configured === true,
      label:
        configuration.credential?.label != null
          ? String(configuration.credential.label)
          : null,
      maskedKey:
        configuration.credential?.maskedKey != null
          ? String(configuration.credential.maskedKey)
          : null
    },
    connections: Array.isArray(configuration.connections)
      ? configuration.connections.map(serializeConfigurationConnection)
      : []
  };

  assertConfigurationAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_ROOT,
    "configuration"
  );
  assertConfigurationAllowlisted(
    out.identity as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_IDENTITY,
    "configuration.identity"
  );
  assertConfigurationAllowlisted(
    out.messages as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_MESSAGES,
    "configuration.messages"
  );
  assertConfigurationAllowlisted(
    out.model as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_MODEL,
    "configuration.model"
  );
  if (out.profile != null) {
    assertConfigurationAllowlisted(
      out.profile,
      ALLOWED_CONFIGURATION_PROFILE,
      "configuration.profile"
    );
  }
  assertConfigurationAllowlisted(
    out.instructions as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_INSTRUCTIONS,
    "configuration.instructions"
  );
  assertConfigurationAllowlisted(
    out.provider as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_PROVIDER,
    "configuration.provider"
  );
  assertConfigurationAllowlisted(
    out.credential as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_CREDENTIAL,
    "configuration.credential"
  );

  return out;
}

export function serializeAiAgentProductConfigurationView(input: {
  agentScope: AiAgentProductAgentScope;
  agentRef?: string;
  configuration: AiAgentProductConfiguration | null;
  editableWhileActive?: boolean;
  summary: AiAgentProductSummary;
}): AiAgentProductConfigurationView {
  const out: AiAgentProductConfigurationView = {
    agentScope: serializeAiAgentAgentScope(input.agentScope),
    configuration:
      input.configuration == null
        ? null
        : serializeAiAgentProductConfiguration(input.configuration),
    summary: serializeAiAgentProductSummary(input.summary)
  };
  if (input.agentRef != null) {
    out.agentRef = String(input.agentRef);
  }
  if (input.configuration != null) {
    out.editableWhileActive = input.editableWhileActive === true;
  }
  assertConfigurationAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_VIEW,
    "configurationView"
  );
  return out;
}

export function serializeAiAgentProductConfigurationResult(input: {
  changed?: boolean;
  created?: boolean;
  agentRef?: string;
  configuration: AiAgentProductConfiguration | null;
  summary: AiAgentProductSummary;
}): AiAgentProductConfigurationResult {
  const out: AiAgentProductConfigurationResult = {
    configuration:
      input.configuration == null
        ? null
        : serializeAiAgentProductConfiguration(input.configuration),
    summary: serializeAiAgentProductSummary(input.summary)
  };
  if (input.changed !== undefined) {
    out.changed = input.changed === true;
  }
  if (input.created !== undefined) {
    out.created = input.created === true;
  }
  if (input.agentRef != null) {
    out.agentRef = String(input.agentRef);
  }
  assertConfigurationAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_RESULT,
    "configurationResult"
  );
  return out;
}

export function serializeAiAgentProductConfigurationOptions(
  options: AiAgentProductConfigurationOptions
): AiAgentProductConfigurationOptions {
  const out: AiAgentProductConfigurationOptions = {
    providers: (options.providers || []).map(p => {
      const row: {
        value: string;
        label: string;
        available: boolean;
        unavailableReason?: string | null;
      } = {
        value: String(p.value || ""),
        label: String(p.label || ""),
        available: p.available === true
      };
      if (p.unavailableReason != null && String(p.unavailableReason).trim()) {
        row.unavailableReason = String(p.unavailableReason);
      }
      assertConfigurationAllowlisted(
        row as unknown as Record<string, unknown>,
        ALLOWED_OPTIONS_PROVIDER,
        "options.providers[]"
      );
      return row;
    }),
    models: (options.models || []).map(model => {
      const row = {
        value: String(model.value || ""),
        label: String(model.label || ""),
        provider: String(model.provider || ""),
        supportsText: model.supportsText !== false,
        supportsVision: model.supportsVision === true,
        supportsAudioTranscription: model.supportsAudioTranscription === true
      };
      assertConfigurationAllowlisted(
        row as unknown as Record<string, unknown>,
        ALLOWED_OPTIONS_MODEL,
        "options.models[]"
      );
      return row;
    }),
    credentials: (options.credentials || []).map(c => {
      const row = {
        ref: String(c.ref),
        name: String(c.name || ""),
        provider: String(c.provider || ""),
        maskedKey: String(c.maskedKey || ""),
        enabled: c.enabled === true,
        isDefault: c.isDefault === true
      };
      assertConfigurationAllowlisted(
        row as unknown as Record<string, unknown>,
        ALLOWED_OPTIONS_CREDENTIAL,
        "options.credentials[]"
      );
      return row;
    }),
    connections: (options.connections || []).map(c => {
      const row: {
        ref: string;
        name: string;
        status: string;
        selected: boolean;
        eligible: boolean;
        ineligibleReason: string | null;
        assignedAgentName?: string | null;
        assignedAgentRef?: string | null;
      } = {
        ref: String(c.ref),
        name: String(c.name || "").trim() || "—",
        status: String(c.status || ""),
        selected: c.selected === true,
        eligible: c.eligible === true,
        ineligibleReason:
          c.ineligibleReason != null ? String(c.ineligibleReason) : null
      };
      if (c.assignedAgentName != null && String(c.assignedAgentName).trim()) {
        row.assignedAgentName = String(c.assignedAgentName).trim();
      }
      if (c.assignedAgentRef != null && String(c.assignedAgentRef).trim()) {
        row.assignedAgentRef = String(c.assignedAgentRef).trim();
      }
      assertConfigurationAllowlisted(
        row as unknown as Record<string, unknown>,
        ALLOWED_OPTIONS_CONNECTION,
        "options.connections[]"
      );
      return row;
    })
  };
  assertConfigurationAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_OPTIONS,
    "configurationOptions"
  );
  return out;
}

const ALLOWED_CONFIGURATION_PREVIEW = new Set(["preview"]);

export function serializeAiAgentProductConfigurationPreview(
  input: Record<string, unknown>
): AiAgentProductConfigurationPreview {
  const out: AiAgentProductConfigurationPreview = {
    preview: String(input.preview || "")
  };
  assertConfigurationAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_CONFIGURATION_PREVIEW,
    "configurationPreview"
  );
  return out;
}

export const AI_AGENT_PRODUCT_CONFIGURATION_ALLOWED_KEYS = [
  ...ALLOWED_CONFIGURATION_ROOT
];
