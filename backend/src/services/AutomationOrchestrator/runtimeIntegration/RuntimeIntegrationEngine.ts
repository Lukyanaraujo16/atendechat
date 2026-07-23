import { createHash } from "crypto";
import { RuntimeIntegrationEventName } from "../../../config/automationRuntimeIntegrationConstants";
import { ExecutionAction } from "../cognitive/action/actionTypes";
import { adaptExecutionActionToRuntimeRequest } from "./ExecutionAdapter";
import { dispatchRuntimeCapability } from "./RuntimeDispatcher";
import {
  defaultRuntimeAdapterRegistry,
  RuntimeAdapterRegistry
} from "./RuntimeAdapterRegistry";
import { evaluateRuntimePolicies } from "./RuntimePolicyEngine";
import { adaptRuntimeResultToActionResult } from "./RuntimeResultAdapter";
import {
  recordRuntimeIntegrationExecution,
  recordRuntimeIntegrationEvent
} from "./RuntimeIntegrationMetrics";
import {
  PolicyEvaluation,
  RuntimeCapability,
  RuntimeExecutionRequest,
  RuntimeIntegrationEvent,
  RuntimeIntegrationRecord
} from "./types";

export type RuntimeIntegrationEngineOptions = {
  companyId: number;
  userId?: number | null;
  adapterRegistry?: RuntimeAdapterRegistry;
  onEvent?: (event: RuntimeIntegrationEvent) => void;
};

function newEventId(requestId: string, name: string): string {
  return `revt_${createHash("sha256")
    .update(`${requestId}:${name}:${Date.now()}`)
    .digest("hex")
    .slice(0, 12)}`;
}

export class RuntimeIntegrationEngine {
  private readonly companyId: number;
  private readonly userId?: number | null;
  private readonly adapterRegistry: RuntimeAdapterRegistry;
  private readonly onEvent?: (event: RuntimeIntegrationEvent) => void;

  constructor(options: RuntimeIntegrationEngineOptions) {
    this.companyId = options.companyId;
    this.userId = options.userId;
    this.adapterRegistry =
      options.adapterRegistry || defaultRuntimeAdapterRegistry;
    this.onEvent = options.onEvent;
  }

  private emit(
    requestId: string,
    name: RuntimeIntegrationEventName,
    message?: string,
    meta?: Record<string, unknown>
  ): RuntimeIntegrationEvent {
    const event: RuntimeIntegrationEvent = {
      id: newEventId(requestId, name),
      requestId,
      name,
      at: new Date().toISOString(),
      message,
      meta
    };
    recordRuntimeIntegrationEvent(event);
    this.onEvent?.(event);
    return event;
  }

  async execute(input: {
    action: ExecutionAction;
    executionId?: string;
    sessionId?: string;
  }): Promise<RuntimeIntegrationRecord> {
    const events: RuntimeIntegrationEvent[] = [];
    const push = (
      requestId: string,
      name: RuntimeIntegrationEventName,
      message?: string,
      meta?: Record<string, unknown>
    ) => {
      events.push(this.emit(requestId, name, message, meta));
    };

    const request = adaptExecutionActionToRuntimeRequest({
      action: input.action,
      companyId: this.companyId,
      executionId: input.executionId || input.sessionId
    });
    request.metadata = {
      ...request.metadata,
      companyId: this.companyId,
      sessionId: input.sessionId
    };

    push(request.requestId, "RUNTIME_REQUEST_CREATED", "Request adaptado");

    const policy = evaluateRuntimePolicies({
      request,
      companyId: this.companyId
    });
    push(request.requestId, "POLICY_VALIDATED", "Políticas validadas", {
      warnings: policy.warnings.length
    });

    const capability = dispatchRuntimeCapability(
      request,
      (request.metadata?.preferredRuntimeType as any) || undefined,
      this.companyId
    );
    if (capability.metadata?.dispatchDecision) {
      request.metadata.dispatchDecision = capability.metadata.dispatchDecision;
    }
    push(request.requestId, "RUNTIME_DISPATCHED", capability.kind, {
      capability: capability.kind,
      adapter: capability.requiredAdapter,
      runtimeType: capability.runtimeType
    });

    const adapter = this.adapterRegistry.resolve(capability);
    const startedAt = new Date().toISOString();

    if (!adapter) {
      push(request.requestId, "RUNTIME_FAILED", "Adapter não encontrado");
      const record: RuntimeIntegrationRecord = {
        id: request.requestId,
        companyId: this.companyId,
        request,
        capability,
        policy,
        events,
        createdAt: startedAt,
        finishedAt: new Date().toISOString()
      };
      recordRuntimeIntegrationExecution(record);
      return record;
    }

    push(request.requestId, "RUNTIME_STARTED", adapter.name);

    let adapterResult;
    try {
      adapterResult = await adapter.execute({
        request,
        capability,
        companyId: this.companyId,
        userId: this.userId
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push(request.requestId, "RUNTIME_FAILED", message);
      const finishedAt = new Date().toISOString();
      const record: RuntimeIntegrationRecord = {
        id: request.requestId,
        companyId: this.companyId,
        request,
        capability,
        policy,
        events,
        createdAt: startedAt,
        finishedAt
      };
      recordRuntimeIntegrationExecution(record);
      return record;
    }

    if (adapterResult.status === "timeout") {
      push(request.requestId, "RUNTIME_TIMEOUT", adapter.name);
    } else if (adapterResult.status === "success" || adapterResult.status === "waiting") {
      push(request.requestId, "RUNTIME_COMPLETED", adapter.name, {
        status: adapterResult.status
      });
    } else {
      push(request.requestId, "RUNTIME_FAILED", adapter.name, {
        status: adapterResult.status
      });
    }

    const finishedAt = new Date().toISOString();
    const actionResult = adaptRuntimeResultToActionResult({
      request,
      adapterResult,
      startedAt,
      finishedAt
    });

    const record: RuntimeIntegrationRecord = {
      id: request.requestId,
      companyId: this.companyId,
      request,
      capability,
      policy,
      adapterResult,
      actionResult,
      events,
      createdAt: startedAt,
      finishedAt
    };
    recordRuntimeIntegrationExecution(record);
    return record;
  }
}

export default RuntimeIntegrationEngine;
