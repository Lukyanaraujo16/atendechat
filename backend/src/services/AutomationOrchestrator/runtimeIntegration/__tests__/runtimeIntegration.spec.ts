/**
 * AI Agent V2.4 — Runtime Integration Layer tests
 */
import {
  RUNTIME_TYPES,
  RUNTIME_CAPABILITY_KINDS,
  RUNTIME_INTEGRATION_EVENTS
} from "../../../../config/automationRuntimeIntegrationConstants";
import { mapStepToExecutionAction } from "../../cognitive/action/ActionExecutionEngine";
import { __resetExecutionSessionsForTests } from "../../cognitive/execution/ExecutionOrchestratorAdminServices";
import { __resetActionExecutionAdminForTests } from "../../cognitive/action/ActionExecutionAdminServices";
import * as ActionExecutionAdminServices from "../../cognitive/action/ActionExecutionAdminServices";
import { adaptExecutionActionToRuntimeRequest } from "../ExecutionAdapter";
import { dispatchRuntimeCapability } from "../RuntimeDispatcher";
import { RuntimeAdapterRegistry } from "../RuntimeAdapterRegistry";
import { evaluateRuntimePolicies } from "../RuntimePolicyEngine";
import { adaptRuntimeResultToActionResult } from "../RuntimeResultAdapter";
import { RuntimeIntegrationEngine } from "../RuntimeIntegrationEngine";
import {
  __resetRuntimeIntegrationConfigForTests,
  getRuntimeIntegrationConfig,
  setRuntimeIntegrationConfig
} from "../RuntimeIntegrationConfig";
import {
  __resetRuntimeIntegrationMetricsForTests
} from "../RuntimeIntegrationMetrics";
import {
  __resetRuntimeIntegrationAdminForTests,
  BuildRuntimeRequestPreviewService,
  ExecuteRuntimeIntegrationService,
  GetRuntimeIntegrationDashboardService,
  InspectRuntimeDispatcherService,
  ReplayRuntimeIntegrationService,
  SimulateRuntimePolicyService
} from "../RuntimeIntegrationAdminServices";
import toolRuntimeAdapter from "../adapters/ToolRuntimeAdapter";
import * as ToolAdminServices from "../../tools/ToolAdminServices";
import * as FcResolver from "../../tools/functionCalling/AutomationFunctionCallResolver";
import * as SelectionEngine from "../../tools/functionCalling/AutomationToolSelectionEngine";

describe("Runtime Integration Layer V2.4", () => {
  beforeEach(() => {
    __resetRuntimeIntegrationConfigForTests();
    __resetRuntimeIntegrationMetricsForTests();
    __resetRuntimeIntegrationAdminForTests();
    __resetExecutionSessionsForTests();
    __resetActionExecutionAdminForTests();
    jest.restoreAllMocks();

    jest.spyOn(ToolAdminServices, "getCompanyToolPolicy").mockResolvedValue({
      enabled: true,
      maxRiskLevel: "read_only",
      allowWrite: false,
      requireConfirmationFor: [],
      deniedToolIds: [],
      allowedToolIds: null,
      metadata: null
    });
    jest.spyOn(SelectionEngine, "selectToolsForFunctionCalling").mockReturnValue({
      tools: [],
      allowlist: [
        { id: "knowledge.search", version: "1.0.0", key: "knowledge.search" }
      ],
      allowedToolKeys: ["knowledge.search"],
      rejected: [],
      provider: "openai",
      origin: "admin_test"
    });
    jest.spyOn(FcResolver, "resolveProviderToolCall").mockResolvedValue({
      callId: "c1",
      toolId: "knowledge.search",
      toolVersion: "1.0.0",
      status: "success",
      arguments: { query: "produto" },
      modelResult: { status: "success", summary: "ok" },
      durationMs: 5
    });
  });

  it("runtime types, capabilities e eventos definidos", () => {
    expect(RUNTIME_TYPES).toContain("TOOL_RUNTIME");
    expect(RUNTIME_TYPES).toContain("MCP");
    expect(RUNTIME_CAPABILITY_KINDS).toContain("SEARCH_KNOWLEDGE");
    expect(RUNTIME_INTEGRATION_EVENTS).toContain("RUNTIME_DISPATCHED");
  });

  it("ExecutionAdapter converte ExecutionAction em RuntimeExecutionRequest sem executar", () => {
    const action = mapStepToExecutionAction({
      stepId: "s1",
      stepType: "search",
      objective: "buscar produto"
    });
    const request = adaptExecutionActionToRuntimeRequest({
      action,
      companyId: 1
    });
    expect(request.actionId).toBe(action.id);
    expect(request.runtimeType).toBe("TOOL_RUNTIME");
    expect(request.operation).toBe("search");
    expect(request.parameters.objective).toBe("buscar produto");
  });

  it("RuntimeDispatcher retorna RuntimeCapability (não adapter direto)", () => {
    const action = mapStepToExecutionAction({
      stepId: "d1",
      stepType: "search",
      objective: "faq"
    });
    const request = adaptExecutionActionToRuntimeRequest({
      action,
      companyId: 2
    });
    const capability = dispatchRuntimeCapability(request);
    expect(capability.kind).toBe("SEARCH_KNOWLEDGE");
    expect(capability.runtimeType).toBe("TOOL_RUNTIME");
    expect(capability.requiredAdapter).toBe("ToolRuntimeAdapter");
    expect(capability.toolId).toBe("knowledge.search");
  });

  it("RuntimeAdapterRegistry resolve capability → adapter concreto", () => {
    const registry = new RuntimeAdapterRegistry([toolRuntimeAdapter]);
    const capability = dispatchRuntimeCapability(
      adaptExecutionActionToRuntimeRequest({
        action: mapStepToExecutionAction({
          stepId: "r1",
          stepType: "custom",
          objective: "echo"
        }),
        companyId: 3
      })
    );
    const adapter = registry.resolve(capability);
    expect(adapter?.name).toBe("ToolRuntimeAdapter");
  });

  it("RuntimePolicyEngine valida sem bloquear automaticamente", () => {
    setRuntimeIntegrationConfig(4, {
      policies: { validateOnly: true }
    } as any);
    const action = mapStepToExecutionAction({
      stepId: "p1",
      stepType: "confirm",
      objective: "confirmar",
      requiresConfirmation: true
    });
    const request = adaptExecutionActionToRuntimeRequest({
      action,
      companyId: 4
    });
    const policy = evaluateRuntimePolicies({ request, companyId: 4 });
    expect(policy.approved).toBe(true);
    expect(policy.warnings).toContain("confirmation_required_not_confirmed");
  });

  it("RuntimeResultAdapter converte Tool result em ActionExecutionResult", () => {
    const action = mapStepToExecutionAction({
      stepId: "a1",
      stepType: "search",
      objective: "x"
    });
    const request = adaptExecutionActionToRuntimeRequest({
      action,
      companyId: 5
    });
    const startedAt = new Date().toISOString();
    const finishedAt = new Date().toISOString();
    const actionResult = adaptRuntimeResultToActionResult({
      request,
      adapterResult: {
        status: "success",
        runtimeType: "TOOL_RUNTIME",
        adapter: "ToolRuntimeAdapter",
        capability: "SEARCH_KNOWLEDGE",
        toolId: "knowledge.search",
        modelResult: { hits: [] },
        errors: [],
        warnings: [],
        durationMs: 12,
        metadata: { reusedExistingRuntime: true }
      },
      startedAt,
      finishedAt
    });
    expect(actionResult.metadata.runtimeIntegrated).toBe(true);
    expect(actionResult.output.reusedExistingRuntime).toBe(true);
    expect(actionResult.strategy).toContain("ToolRuntimeAdapter");
  });

  it("ToolRuntimeAdapter reutiliza Selection Engine + FC Resolver + Tool Runtime", async () => {
    const action = mapStepToExecutionAction({
      stepId: "t1",
      stepType: "search",
      objective: "produto",
      metadata: { parameters: { query: "produto" } }
    });
    const request = adaptExecutionActionToRuntimeRequest({
      action,
      companyId: 6
    });
    const capability = dispatchRuntimeCapability(request);
    const result = await toolRuntimeAdapter.execute({
      request,
      capability,
      companyId: 6,
      userId: 1
    });
    expect(result.metadata.reusedExistingRuntime).toBe(true);
    expect(result.metadata.selectionEngine).toBe(true);
    expect(result.metadata.functionCallingResolver).toBe(true);
    expect(result.metadata.toolRuntime).toBe(true);
    expect(["success", "denied", "failure"]).toContain(result.status);
  });

  it("RuntimeIntegrationEngine orquestra request → policy → dispatch → adapter", async () => {
    const action = mapStepToExecutionAction({
      stepId: "e1",
      stepType: "confirm",
      objective: "engine",
      requiresConfirmation: true
    });
    const engine = new RuntimeIntegrationEngine({ companyId: 7, userId: 1 });
    const record = await engine.execute({ action });
    expect(record.request.requestId).toBeTruthy();
    expect(record.capability.requiredAdapter).toBe("ToolRuntimeAdapter");
    expect(record.policy.approved).toBe(true);
    expect(record.events.some(e => e.name === "RUNTIME_DISPATCHED")).toBe(true);
    expect(record.actionResult?.metadata.runtimeIntegrated).toBe(true);
    expect(record.actionResult?.status).toBe("WAITING");
  });

  it("admin services: preview, dispatcher inspect, policy simulate", async () => {
    const action = mapStepToExecutionAction({
      stepId: "adm",
      stepType: "search",
      objective: "admin"
    });
    const preview = await BuildRuntimeRequestPreviewService({
      companyId: 8,
      action
    });
    expect(preview.capability.kind).toBe("SEARCH_KNOWLEDGE");
    const inspect = await InspectRuntimeDispatcherService({
      companyId: 8,
      actionType: "SEARCH"
    });
    expect(inspect.capability.runtimeType).toBe("TOOL_RUNTIME");
    const policy = await SimulateRuntimePolicyService({ companyId: 8, action });
    expect(policy.policy.approved).toBe(true);
  });

  it("ExecuteRuntimeIntegrationService e dashboard", async () => {
    await ExecuteRuntimeIntegrationService({
      companyId: 9,
      userId: 1,
      stepId: "x",
      stepType: "search",
      objective: "svc"
    });
    const dash = await GetRuntimeIntegrationDashboardService({ companyId: 9 });
    expect(dash.reusedExistingRuntime).toBe(true);
    expect(dash.duplicateRuntimeCreated).toBe(false);
    expect(dash.requests).toBeGreaterThanOrEqual(1);
  });

  it("replay expande Goal→...→Runtime Request→Result→Action Result", async () => {
    const cognitiveReplay = {
      id: "r1",
      sessionId: "s1",
      goal: { id: "g1" },
      plan: { id: "p1" },
      evaluation: { id: "e1" },
      session: { id: "s1", graph: { nodes: [] } },
      actionExecutions: [
        {
          action: mapStepToExecutionAction({
            stepId: "s1",
            stepType: "search",
            objective: "produto"
          }),
          result: {
            actionId: "a1",
            status: "SUCCESS"
          },
          events: []
        }
      ]
    };
    jest
      .spyOn(ActionExecutionAdminServices, "ReplayActionExecutionService")
      .mockResolvedValue({ replay: cognitiveReplay as any });

    const { replay } = await ReplayRuntimeIntegrationService({
      companyId: 10,
      userId: 1,
      text: "como funciona o produto?"
    });
    expect(replay.cognitive.goal).toBeTruthy();
    expect(replay.cognitive.plan).toBeTruthy();
    expect(replay.runtimeSlices.length).toBe(1);
    expect(replay.runtimeSlices[0].request.requestId).toBeTruthy();
    expect(replay.runtimeSlices[0].actionResult).toBeTruthy();
  });

  it("config administrativa sem hardcode em runtime", () => {
    setRuntimeIntegrationConfig(11, {
      timeouts: { defaultMs: 9999, toolRuntimeMs: 8888, policyMs: 1000 }
    } as any);
    const cfg = getRuntimeIntegrationConfig(11);
    expect(cfg.timeouts.toolRuntimeMs).toBe(8888);
  });
});
