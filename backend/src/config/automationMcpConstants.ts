/**
 * AI Agent V2.7 — MCP Runtime.
 * Integra Model Context Protocol via Runtime Integration Layer.
 * Admin/tester only — sem Live.
 */

export const AUTOMATION_MCP_VERSION = "2.7.0";
export const AUTOMATION_MCP_FEATURE_KEY = "automation.mcp";
export const AUTOMATION_MCP_SDK_PACKAGE = "@modelcontextprotocol/sdk";
export const AUTOMATION_MCP_SDK_VERSION = "1.29.0";

export const MCP_TRANSPORT_TYPES = [
  "STREAMABLE_HTTP",
  "STDIO",
  "SSE_LEGACY"
] as const;

export type McpTransportType = (typeof MCP_TRANSPORT_TYPES)[number];

export const MCP_AUTH_TYPES = [
  "NONE",
  "BEARER_TOKEN",
  "API_KEY_HEADER",
  "BASIC_AUTH",
  "CUSTOM_HEADERS"
] as const;

export type McpAuthType = (typeof MCP_AUTH_TYPES)[number];

export const MCP_CONNECTION_STATES = [
  "DISCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "DEGRADED",
  "FAILED",
  "CLOSING"
] as const;

export type McpConnectionState = (typeof MCP_CONNECTION_STATES)[number];

export const MCP_HEALTH_STATES = [
  "HEALTHY",
  "DEGRADED",
  "UNHEALTHY",
  "UNKNOWN"
] as const;

export type McpHealthState = (typeof MCP_HEALTH_STATES)[number];

export const MCP_TOOL_CLASSIFICATIONS = ["READ", "WRITE", "UNKNOWN"] as const;
export type McpToolClassification = (typeof MCP_TOOL_CLASSIFICATIONS)[number];

export const MCP_EXECUTION_MODES = [
  "PREVIEW",
  "DRY_RUN",
  "CONFIRMATION_REQUIRED",
  "EXECUTE",
  "BLOCKED"
] as const;

export type McpExecutionMode = (typeof MCP_EXECUTION_MODES)[number];

export const MCP_ADAPTER_PREFERENCES = [
  "TOOL_RUNTIME_FIRST",
  "MCP_FIRST",
  "MCP_ONLY",
  "TOOL_RUNTIME_ONLY",
  "AUTOMATIC"
] as const;

export type McpAdapterPreference = (typeof MCP_ADAPTER_PREFERENCES)[number];

export const MCP_ERROR_CODES = [
  "ERR_MCP_SERVER_NOT_FOUND",
  "ERR_MCP_SERVER_DISABLED",
  "ERR_MCP_TRANSPORT_NOT_ALLOWED",
  "ERR_MCP_CONNECTION_FAILED",
  "ERR_MCP_CONNECTION_TIMEOUT",
  "ERR_MCP_EXECUTION_TIMEOUT",
  "ERR_MCP_TOOL_NOT_FOUND",
  "ERR_MCP_TOOL_DISABLED",
  "ERR_MCP_TOOL_BLOCKED",
  "ERR_MCP_TOOL_CONFIRMATION_REQUIRED",
  "ERR_MCP_INPUT_INVALID",
  "ERR_MCP_POLICY_DENIED",
  "ERR_MCP_RATE_LIMIT",
  "ERR_MCP_UNHEALTHY",
  "ERR_MCP_PROTOCOL",
  "ERR_MCP_RESULT_INVALID",
  "ERR_MCP_CREDENTIAL_INVALID",
  "ERR_MCP_TENANT_FORBIDDEN"
] as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[number];

export const MCP_EVENTS = [
  "MCP_SERVER_CREATED",
  "MCP_SERVER_UPDATED",
  "MCP_SERVER_ENABLED",
  "MCP_SERVER_DISABLED",
  "MCP_CONNECTION_STARTED",
  "MCP_CONNECTION_ESTABLISHED",
  "MCP_CONNECTION_FAILED",
  "MCP_CATALOG_SYNCED",
  "MCP_TOOL_DISCOVERED",
  "MCP_TOOL_CHANGED",
  "MCP_POLICY_EVALUATED",
  "MCP_EXECUTION_STARTED",
  "MCP_EXECUTION_COMPLETED",
  "MCP_EXECUTION_FAILED",
  "MCP_FALLBACK_SELECTED",
  "MCP_CONFIRMATION_REQUIRED"
] as const;

export type McpEventName = (typeof MCP_EVENTS)[number];

export const DEFAULT_MCP_CONFIG = {
  enabled: true,
  allowedTransports: ["STREAMABLE_HTTP", "SSE_LEGACY"] as McpTransportType[],
  stdioEnabled: false,
  maxServersPerCompany: 20,
  maxToolsPerServer: 200,
  connectionTimeoutMs: 10_000,
  executionTimeoutMs: 20_000,
  idleConnectionTimeoutMs: 120_000,
  catalogSyncInterval: 300_000,
  maxConcurrentExecutions: 5,
  maxRetries: 1,
  readToolsDefaultEnabled: true,
  writeToolsDefaultEnabled: false,
  unknownToolsDefaultEnabled: false,
  requireConfirmationForWrites: true,
  allowFallback: true,
  logRetentionDays: 30,
  auditPayloadLimit: 4_000,
  healthCheckInterval: 60_000,
  maxConnections: 50,
  connectionTtlMs: 600_000,
  maxFailuresBeforeEviction: 5,
  blockedHosts: [
    "169.254.169.254",
    "metadata.google.internal",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1"
  ],
  allowPrivateNetworks: false,
  liveIntegrationEnabled: false,
  usesEmbeddings: false
} as const;

export type AutomationMcpConfig = {
  enabled: boolean;
  allowedTransports: McpTransportType[];
  stdioEnabled: boolean;
  maxServersPerCompany: number;
  maxToolsPerServer: number;
  connectionTimeoutMs: number;
  executionTimeoutMs: number;
  idleConnectionTimeoutMs: number;
  catalogSyncInterval: number;
  maxConcurrentExecutions: number;
  maxRetries: number;
  readToolsDefaultEnabled: boolean;
  writeToolsDefaultEnabled: boolean;
  unknownToolsDefaultEnabled: boolean;
  requireConfirmationForWrites: boolean;
  allowFallback: boolean;
  logRetentionDays: number;
  auditPayloadLimit: number;
  healthCheckInterval: number;
  maxConnections: number;
  connectionTtlMs: number;
  maxFailuresBeforeEviction: number;
  blockedHosts: string[];
  allowPrivateNetworks: boolean;
  liveIntegrationEnabled: false;
  usesEmbeddings: false;
  capabilityPreferences?: Record<string, McpAdapterPreference>;
};

export const MCP_PERMISSIONS = [
  "automation.mcp.view",
  "automation.mcp.manageServers",
  "automation.mcp.manageCredentials",
  "automation.mcp.syncCatalog",
  "automation.mcp.testReadTools",
  "automation.mcp.executeWriteTools",
  "automation.mcp.confirmWriteTools",
  "automation.mcp.viewAudit"
] as const;
