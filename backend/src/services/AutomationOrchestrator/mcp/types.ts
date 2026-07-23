import {
  McpAdapterPreference,
  McpAuthType,
  McpConnectionState,
  McpErrorCode,
  McpEventName,
  McpExecutionMode,
  McpHealthState,
  McpToolClassification,
  McpTransportType,
  AUTOMATION_MCP_VERSION
} from "../../../config/automationMcpConstants";
import { RuntimeType } from "../../../config/automationRuntimeIntegrationConstants";

export type McpServerConfig = {
  id: string;
  companyId: number;
  name: string;
  description: string;
  enabled: boolean;
  transportType: McpTransportType;
  endpoint: string | null;
  command: string | null;
  args: string[];
  environment: Record<string, string>;
  headers: Record<string, string>;
  credentialId: string | null;
  connectionTimeoutMs: number;
  executionTimeoutMs: number;
  allowedCapabilities: string[];
  allowedTools: string[] | null;
  blockedTools: string[];
  requireConfirmationForWrites: boolean;
  readOnly: boolean;
  healthStatus: McpHealthState;
  lastHealthCheckAt: string | null;
  lastConnectedAt: string | null;
  lastErrorCode: McpErrorCode | string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type McpCredential = {
  id: string;
  companyId: number;
  name: string;
  authType: McpAuthType;
  encryptedPayload: string;
  maskedPreview: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  metadata: Record<string, unknown>;
};

export type McpToolDescriptor = {
  serverId: string;
  companyId: number;
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
  annotations: Record<string, unknown>;
  readOnlyHint: boolean | null;
  destructiveHint: boolean | null;
  idempotentHint: boolean | null;
  openWorldHint: boolean | null;
  requiresConfirmation: boolean;
  enabled: boolean;
  classification: McpToolClassification;
  capabilityOverride: string | null;
  discoveredAt: string;
  schemaHash: string;
  metadata: Record<string, unknown>;
};

export type RuntimeDispatchDecision = {
  requestId: string;
  capability: string;
  selectedRuntimeType: RuntimeType;
  selectedAdapter: string;
  selectedServerId: string | null;
  selectedTool: string | null;
  reasonCodes: string[];
  fallbackRuntimeType: RuntimeType | null;
  fallbackAvailable: boolean;
  confidence: number;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type McpPolicyDecision = {
  approved: boolean;
  executionMode: McpExecutionMode;
  requiresConfirmation: boolean;
  violations: string[];
  warnings: string[];
  reasonCodes: string[];
  effectiveTimeout: number;
  effectiveRateLimit: number | null;
  sanitizedArguments: Record<string, unknown>;
  classification: McpToolClassification;
  metadata: Record<string, unknown>;
};

export type NormalizedMcpResult = {
  success: boolean;
  content: string;
  structuredData: Record<string, unknown> | null;
  resources: Array<Record<string, unknown>>;
  warnings: string[];
  error: string | null;
  isError: boolean;
  rawMetadata: Record<string, unknown>;
};

export type McpConnectionRecord = {
  key: string;
  companyId: number;
  serverId: string;
  state: McpConnectionState;
  createdAt: string;
  lastUsedAt: string;
  activeExecutions: number;
  failureCount: number;
  lastError: string | null;
};

export type McpAuditEntry = {
  id: string;
  companyId: number;
  userId: number | null;
  agentId: number | null;
  sessionId: string | null;
  actionId: string | null;
  runtimeRequestId: string | null;
  serverId: string;
  toolName: string;
  runtimeType: "MCP";
  operationClassification: McpToolClassification;
  policyDecision: McpExecutionMode;
  argumentsSanitized: Record<string, unknown>;
  startedAt: string;
  finishedAt: string;
  status: string;
  errorCode: string | null;
  resultSummary: string;
};

export type McpEvent = {
  id: string;
  companyId: number;
  name: McpEventName | string;
  at: string;
  message?: string;
  meta?: Record<string, unknown>;
};

export type McpExecutionRecord = {
  id: string;
  companyId: number;
  serverId: string;
  toolName: string;
  dispatch: RuntimeDispatchDecision;
  policy: McpPolicyDecision;
  result: NormalizedMcpResult | null;
  status: string;
  durationMs: number;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type { McpAdapterPreference };

export { AUTOMATION_MCP_VERSION };
