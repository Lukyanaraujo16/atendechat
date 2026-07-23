import {
  RuntimeCapabilityKind,
  RuntimeIntegrationEventName,
  RuntimeType,
  AUTOMATION_RUNTIME_INTEGRATION_VERSION
} from "../../../config/automationRuntimeIntegrationConstants";
import { ActionExecutionResult } from "../cognitive/action/actionTypes";

export type RuntimeRetryPolicy = {
  maxAttempts: number;
  backoffMs: number;
};

export type RuntimeConfirmationPolicy = {
  required: boolean;
  confirmed: boolean;
};

export type RuntimeExecutionRequest = {
  requestId: string;
  actionId: string;
  executionId: string;
  runtimeType: RuntimeType;
  operation: string;
  entities: Array<{ key: string; value: string }>;
  parameters: Record<string, unknown>;
  constraints: string[];
  timeout: number;
  retryPolicy: RuntimeRetryPolicy;
  confirmationPolicy: RuntimeConfirmationPolicy;
  metadata: Record<string, unknown>;
};

export type RuntimeCapability = {
  kind: RuntimeCapabilityKind;
  runtimeType: RuntimeType;
  requiredAdapter: string;
  toolId?: string;
  providerFunctionName?: string;
  plannerCategories?: string[];
  metadata: Record<string, unknown>;
};

export type PolicyEvaluation = {
  approved: boolean;
  warnings: string[];
  violations: string[];
  costEstimate: number;
  timeout: number;
  retry: RuntimeRetryPolicy;
  metadata: Record<string, unknown>;
};

export type RuntimeIntegrationEvent = {
  id: string;
  requestId: string;
  name: RuntimeIntegrationEventName | string;
  at: string;
  message?: string;
  meta?: Record<string, unknown>;
};

export type RuntimeAdapterResult = {
  status: "success" | "failure" | "denied" | "waiting" | "timeout";
  runtimeType: RuntimeType;
  adapter: string;
  capability: RuntimeCapabilityKind;
  toolId?: string;
  modelResult?: Record<string, unknown>;
  internalData?: Record<string, unknown>;
  selection?: Record<string, unknown>;
  resolution?: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  durationMs: number;
  metadata: Record<string, unknown>;
};

export type RuntimeIntegrationRecord = {
  id: string;
  companyId: number;
  request: RuntimeExecutionRequest;
  capability: RuntimeCapability;
  policy: PolicyEvaluation;
  adapterResult?: RuntimeAdapterResult;
  actionResult?: ActionExecutionResult;
  events: RuntimeIntegrationEvent[];
  createdAt: string;
  finishedAt?: string;
};

export type RuntimeIntegrationReplaySlice = {
  action: import("../cognitive/action/actionTypes").ExecutionAction;
  request: RuntimeExecutionRequest;
  capability: RuntimeCapability;
  policy: PolicyEvaluation;
  adapterResult: RuntimeAdapterResult;
  actionResult: ActionExecutionResult;
  events: RuntimeIntegrationEvent[];
};

export { AUTOMATION_RUNTIME_INTEGRATION_VERSION };
