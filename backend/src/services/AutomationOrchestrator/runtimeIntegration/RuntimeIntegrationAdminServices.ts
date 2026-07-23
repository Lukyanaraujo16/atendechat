import { createHash } from "crypto";
import { mapStepToExecutionAction } from "../cognitive/action/ActionExecutionEngine";
import { ExecutionAction } from "../cognitive/action/actionTypes";
import { ReplayActionExecutionService } from "../cognitive/action/ActionExecutionAdminServices";
import { RuntimeIntegrationEngine } from "./RuntimeIntegrationEngine";
import {
  getRuntimeIntegrationConfig,
  setRuntimeIntegrationConfig
} from "./RuntimeIntegrationConfig";
import { adaptExecutionActionToRuntimeRequest } from "./ExecutionAdapter";
import { dispatchRuntimeCapability } from "./RuntimeDispatcher";
import { evaluateRuntimePolicies } from "./RuntimePolicyEngine";
import { defaultRuntimeAdapterRegistry } from "./RuntimeAdapterRegistry";
import {
  findRuntimeIntegrationRecord,
  getRuntimeIntegrationMetrics,
  listRuntimeIntegrationRecords
} from "./RuntimeIntegrationMetrics";
import {
  RuntimeIntegrationRecord,
  RuntimeIntegrationReplaySlice
} from "./types";

const replaysByCompany = new Map<
  number,
  Array<{
    id: string;
    slices: RuntimeIntegrationReplaySlice[];
    createdAt: string;
  }>
>();

function pushCap<T>(arr: T[], item: T, max = 100): void {
  arr.push(item);
  if (arr.length > max) arr.shift();
}

export async function ExecuteRuntimeIntegrationService(input: {
  companyId: number;
  userId?: number | null;
  action?: ExecutionAction;
  stepId?: string;
  stepType?: string;
  objective?: string;
  sessionId?: string;
  executionId?: string;
}): Promise<{ record: RuntimeIntegrationRecord }> {
  let action = input.action;
  if (!action) {
    if (!input.stepId || !input.stepType) {
      throw new Error("action ou stepId+stepType obrigatórios");
    }
    action = mapStepToExecutionAction({
      stepId: input.stepId,
      stepType: input.stepType,
      objective: input.objective || "runtime integration"
    });
  }

  const engine = new RuntimeIntegrationEngine({
    companyId: input.companyId,
    userId: input.userId
  });
  const record = await engine.execute({
    action,
    sessionId: input.sessionId,
    executionId: input.executionId
  });
  return { record };
}

export async function ListRuntimeRequestsService(input: {
  companyId: number;
  limit?: number;
}) {
  return {
    requests: listRuntimeIntegrationRecords(input.limit || 50),
    metrics: getRuntimeIntegrationMetrics()
  };
}

export async function GetRuntimeRequestService(input: {
  companyId: number;
  id: string;
}) {
  return { request: findRuntimeIntegrationRecord(input.id) };
}

export async function GetRuntimeIntegrationDashboardService(input: {
  companyId: number;
}) {
  const metrics = getRuntimeIntegrationMetrics();
  return {
    requests: metrics.requests,
    dispatcher: metrics.dispatcherUsage,
    policies: {
      warnings: metrics.policyWarnings
    },
    latency: metrics.averageLatency,
    cost: metrics.averageCost,
    failures: metrics.failure,
    metrics,
    reusedExistingRuntime: true,
    duplicateRuntimeCreated: false
  };
}

export async function GetRuntimePoliciesService(input: { companyId: number }) {
  const config = getRuntimeIntegrationConfig(input.companyId);
  return {
    policies: config.policies,
    timeouts: config.timeouts,
    retry: config.retry,
    cost: config.cost,
    validateOnly: config.policies.validateOnly
  };
}

export async function GetRuntimeIntegrationConfigService(input: {
  companyId: number;
}) {
  return { config: getRuntimeIntegrationConfig(input.companyId) };
}

export async function UpsertRuntimeIntegrationConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  return {
    config: setRuntimeIntegrationConfig(input.companyId, input.config)
  };
}

export async function BuildRuntimeRequestPreviewService(input: {
  companyId: number;
  action: ExecutionAction;
}) {
  const request = adaptExecutionActionToRuntimeRequest({
    action: input.action,
    companyId: input.companyId
  });
  const capability = dispatchRuntimeCapability(request, request.runtimeType);
  const policy = evaluateRuntimePolicies({ request, companyId: input.companyId });
  const adapter = defaultRuntimeAdapterRegistry.resolve(capability);
  return { request, capability, policy, adapter: adapter?.name || null };
}

export async function InspectRuntimeDispatcherService(input: {
  companyId: number;
  actionType?: string;
  operation?: string;
}) {
  const action = mapStepToExecutionAction({
    stepId: "inspect",
    stepType: input.operation || "search",
    objective: "inspect dispatcher"
  });
  if (input.actionType) {
    action.actionType = input.actionType as ExecutionAction["actionType"];
  }
  const request = adaptExecutionActionToRuntimeRequest({
    action,
    companyId: input.companyId
  });
  const capability = dispatchRuntimeCapability(request, request.runtimeType);
  return { request, capability };
}

export async function SimulateRuntimePolicyService(input: {
  companyId: number;
  action: ExecutionAction;
}) {
  const request = adaptExecutionActionToRuntimeRequest({
    action: input.action,
    companyId: input.companyId
  });
  return {
    policy: evaluateRuntimePolicies({ request, companyId: input.companyId })
  };
}

export async function ReplayRuntimeIntegrationService(input: {
  companyId: number;
  userId?: number | null;
  text?: string;
  sessionId?: string;
}): Promise<{
  replay: {
    cognitive: Awaited<ReturnType<typeof ReplayActionExecutionService>>["replay"];
    runtimeSlices: RuntimeIntegrationReplaySlice[];
  };
}> {
  const { replay } = await ReplayActionExecutionService({
    companyId: input.companyId,
    sessionId: input.sessionId,
    text: input.text
  });

  const engine = new RuntimeIntegrationEngine({
    companyId: input.companyId,
    userId: input.userId
  });

  const runtimeSlices: RuntimeIntegrationReplaySlice[] = [];

  for (const slice of replay.actionExecutions || []) {
    const record = await engine.execute({
      action: slice.action,
      sessionId: replay.sessionId,
      executionId: replay.sessionId
    });
    runtimeSlices.push({
      action: slice.action,
      request: record.request,
      capability: record.capability,
      policy: record.policy,
      adapterResult: record.adapterResult || {
        status: "failure",
        runtimeType: "TOOL_RUNTIME",
        adapter: "none",
        capability: record.capability.kind,
        errors: ["adapter_result_missing"],
        warnings: [],
        durationMs: 0,
        metadata: {}
      },
      actionResult: record.actionResult || slice.result,
      events: record.events
    });
  }

  const replayId = `rtreplay_${createHash("sha256")
    .update(`${replay.id}:${Date.now()}`)
    .digest("hex")
    .slice(0, 12)}`;
  const replays = replaysByCompany.get(input.companyId) || [];
  pushCap(replays, {
    id: replayId,
    slices: runtimeSlices,
    createdAt: new Date().toISOString()
  });
  replaysByCompany.set(input.companyId, replays);

  return {
    replay: {
      cognitive: replay,
      runtimeSlices
    }
  };
}

export function __resetRuntimeIntegrationAdminForTests(): void {
  replaysByCompany.clear();
}

export default {
  ExecuteRuntimeIntegrationService,
  GetRuntimeIntegrationDashboardService
};
