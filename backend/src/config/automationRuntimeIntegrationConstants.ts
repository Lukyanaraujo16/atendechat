/**
 * AI Agent V2.4 — Runtime Integration Layer.
 * Conecta Core Cognitivo ao Runtime existente via contratos.
 */

export const AUTOMATION_RUNTIME_INTEGRATION_VERSION = "2.4.0";

export const RUNTIME_TYPES = [
  "TOOL_RUNTIME",
  "MCP",
  "MEMORY",
  "WORKFLOW",
  "HUMAN",
  "CUSTOM"
] as const;

export type RuntimeType = (typeof RUNTIME_TYPES)[number];

export const RUNTIME_CAPABILITY_KINDS = [
  "SEARCH_CONTACT",
  "SEARCH_KNOWLEDGE",
  "SEARCH_TICKET",
  "VALIDATE_CONTEXT",
  "TRANSFER_TICKET",
  "UPDATE_ENTITY",
  "SEND_MESSAGE",
  "WAIT_CONFIRMATION",
  "WAIT_INPUT",
  "CUSTOM_OPERATION"
] as const;

export type RuntimeCapabilityKind = (typeof RUNTIME_CAPABILITY_KINDS)[number];

export const RUNTIME_INTEGRATION_EVENTS = [
  "RUNTIME_REQUEST_CREATED",
  "RUNTIME_DISPATCHED",
  "RUNTIME_STARTED",
  "RUNTIME_COMPLETED",
  "RUNTIME_FAILED",
  "RUNTIME_TIMEOUT",
  "POLICY_VALIDATED"
] as const;

export type RuntimeIntegrationEventName =
  (typeof RUNTIME_INTEGRATION_EVENTS)[number];

export const DEFAULT_RUNTIME_INTEGRATION_CONFIG = {
  timeouts: {
    defaultMs: 15_000,
    toolRuntimeMs: 12_000,
    policyMs: 2_000
  },
  retry: {
    maxAttempts: 1,
    backoffMs: 250
  },
  cost: {
    tokenBudget: 8000,
    costBudgetUsd: 0.05,
    estimatePerRequestUsd: 0.001
  },
  policies: {
    validateOnly: true,
    enforceConfirmation: false,
    enforceRateLimit: false,
    enforcePermission: false
  },
  dispatcher: {
    defaultRuntimeType: "TOOL_RUNTIME" as RuntimeType
  },
  adapters: {
    TOOL_RUNTIME: {
      enabled: true,
      origin: "admin_test",
      allowWriteDryRun: true
    }
  }
} as const;

export type RuntimeIntegrationConfig = {
  timeouts: {
    defaultMs: number;
    toolRuntimeMs: number;
    policyMs: number;
  };
  retry: {
    maxAttempts: number;
    backoffMs: number;
  };
  cost: {
    tokenBudget: number;
    costBudgetUsd: number;
    estimatePerRequestUsd: number;
  };
  policies: {
    validateOnly: boolean;
    enforceConfirmation: boolean;
    enforceRateLimit: boolean;
    enforcePermission: boolean;
  };
  dispatcher: {
    defaultRuntimeType: RuntimeType;
  };
  adapters: Record<
    string,
    {
      enabled: boolean;
      origin: string;
      allowWriteDryRun: boolean;
    }
  >;
};

export const RUNTIME_INTEGRATION_SETTING_KEY = "automationRuntimeIntegration";
