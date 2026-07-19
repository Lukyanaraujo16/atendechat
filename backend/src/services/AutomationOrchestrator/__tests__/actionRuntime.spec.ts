import {
  AUTOMATION_DEFAULT_CONTROL_MODE
} from "../../../config/automationOrchestratorConstants";
import {
  clearActionRegistry,
  discoverActionsForCapability,
  getAction,
  getActionManifest,
  listActionManifests,
  listActionsByCategory,
  registerAction,
  validateActionManifest
} from "../ActionRegistry";
import {
  defineAction,
  runActionViaRuntime
} from "../AutomationActionRuntime";
import {
  clearCapabilityRegistry,
  ensureCapabilityRegistrySeeded,
  listCapabilities
} from "../CapabilityRegistry";
import {
  buildManifest,
  classifyActionError
} from "../contracts/ActionContract";
import {
  registerBuiltinActions,
  resetBuiltinActionsRegistration
} from "../registerBuiltinActions";
import { mergeCapabilities } from "../activation/capabilityPolicy";
import { ExecutionContext } from "../types";

function baseCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    companyId: 1,
    ticketId: 10,
    contactId: 20,
    whatsappId: 30,
    channel: "whatsapp",
    messageId: "msg-1",
    ticket: {
      id: 10,
      status: "pending",
      userId: null,
      chatbot: false,
      queueId: null,
      aiAgentId: null,
      aiAgentPaused: false,
      aiAgentHandoffRequested: false,
      isGroup: false
    },
    contact: { id: 20, name: "Test" },
    currentMessage: { body: "oi", fromMe: false, hasText: true },
    conversationHistory: [],
    aiAgent: null,
    knowledge: {},
    variables: {},
    flowState: { active: false },
    chatbotState: { active: false },
    integrationState: { active: false },
    controlMode: AUTOMATION_DEFAULT_CONTROL_MODE,
    metadata: {},
    ...overrides
  };
}

describe("Action Contract 2.0.2", () => {
  beforeEach(() => {
    clearActionRegistry();
    resetBuiltinActionsRegistration();
    clearCapabilityRegistry();
    ensureCapabilityRegistrySeeded();
  });

  it("buildManifest preenche defaults", () => {
    const m = buildManifest({
      id: "X",
      name: "X",
      category: "system",
      capabilities: ["planner"]
    });
    expect(m.version).toBe("1.0.0");
    expect(m.timeoutMs).toBe(15000);
    expect(m.retryPolicy.retryable).toBe(false);
    expect(m.sideEffects).toBe(false);
    expect(validateActionManifest(m)).toEqual([]);
  });

  it("classifyActionError mapeia timeout e validation", () => {
    expect(classifyActionError(new Error("ACTION_TIMEOUT")).code).toBe(
      "timeout"
    );
    expect(
      classifyActionError(new Error("ACTION_VALIDATION: missing_input:a")).code
    ).toBe("validation");
  });

  it("Capability Registry lista core e future", () => {
    const caps = listCapabilities({ includeFuture: true });
    expect(caps.some(c => c.id === "planner")).toBe(true);
    expect(caps.some(c => c.id === "future.http" && c.future)).toBe(true);
  });

  it("builtins registram manifests e discovery por capability", () => {
    registerBuiltinActions();
    const manifests = listActionManifests();
    expect(manifests.length).toBeGreaterThanOrEqual(9);
    expect(getActionManifest("ClassifyIntent")?.capabilities).toContain(
      "classification"
    );
    expect(
      discoverActionsForCapability("classification").some(
        a => a.name === "ClassifyIntent"
      )
    ).toBe(true);
    expect(listActionsByCategory("human").some(a => a.name === "HumanHandoffAction")).toBe(
      true
    );
  });

  it("Runtime observe executa ClassifyIntent sem mudar resultado legado", async () => {
    registerBuiltinActions();
    const action = getAction("ClassifyIntent");
    expect(action).toBeTruthy();
    const runtime = await runActionViaRuntime({
      action: action!,
      ctx: baseCtx(),
      controlMode: "observe",
      capabilities: mergeCapabilities(null)
    });
    expect(runtime.legacyResult.status).toBe("success");
    expect(runtime.legacyResult.nextHint).toBe("continue");
    expect(runtime.manifest.id).toBe("ClassifyIntent");
    expect(runtime.metrics.attempts).toBe(1);
  });

  it("Runtime shadow bloqueia Flow (side effects)", async () => {
    registerBuiltinActions();
    const action = getAction("FlowAction");
    const runtime = await runActionViaRuntime({
      action: action!,
      ctx: baseCtx({ controlMode: "shadow_execute" }),
      controlMode: "shadow_execute",
      capabilities: mergeCapabilities(null)
    });
    expect(runtime.legacyResult.status).toBe("skip");
    expect(runtime.legacyResult.data?.capabilityBlocked).toBe(true);
  });

  it("Runtime timeout + retry policy", async () => {
    let calls = 0;
    const action = defineAction(
      {
        id: "SlowAction",
        name: "SlowAction",
        category: "system",
        capabilities: ["planner"],
        timeoutMs: 30,
        retryPolicy: { retryable: true, maxRetries: 1, backoffMs: 1 }
      },
      {
        async execute() {
          calls += 1;
          await new Promise(r => setTimeout(r, 80));
          return { status: "success", nextHint: "continue" };
        }
      }
    );
    registerAction(action);
    const runtime = await runActionViaRuntime({
      action,
      ctx: baseCtx(),
      controlMode: "observe",
      capabilities: mergeCapabilities(null),
      timeoutCeilingMs: 30
    });
    expect(runtime.legacyResult.status).toBe("failure");
    expect(runtime.metrics.timedOut).toBe(true);
    expect(calls).toBe(2);
  });

  it("Runtime chama rollback quando suportado e execute falha", async () => {
    let rolled = false;
    const action = defineAction(
      {
        id: "RollbackAction",
        name: "RollbackAction",
        category: "system",
        capabilities: ["planner"],
        rollbackSupported: true
      },
      {
        async execute() {
          throw new Error("boom");
        },
        async rollback() {
          rolled = true;
        }
      }
    );
    const runtime = await runActionViaRuntime({
      action,
      ctx: baseCtx(),
      controlMode: "observe",
      capabilities: mergeCapabilities(null)
    });
    expect(runtime.legacyResult.status).toBe("failure");
    expect(rolled).toBe(true);
    expect(runtime.metrics.rolledBack).toBe(true);
  });

  it("Runtime valida input obrigatório do manifest", async () => {
    const action = defineAction(
      {
        id: "NeedsInput",
        name: "NeedsInput",
        category: "system",
        capabilities: ["planner"],
        inputs: [{ name: "foo", type: "string", required: true }]
      },
      {
        async execute() {
          return { status: "success", nextHint: "continue" };
        }
      }
    );
    const runtime = await runActionViaRuntime({
      action,
      ctx: baseCtx(),
      params: {},
      controlMode: "observe",
      capabilities: mergeCapabilities(null)
    });
    expect(runtime.legacyResult.status).toBe("failure");
    expect(runtime.errors[0]?.code).toBe("validation");
  });

  it("plugin externo registra sem assumir builtins", () => {
    registerAction(
      defineAction(
        {
          id: "External.Http",
          name: "ExternalHttp",
          category: "future",
          capabilities: ["future.http"],
          experimental: true
        },
        {
          async execute() {
            return { status: "success", nextHint: "continue" };
          }
        }
      )
    );
    expect(getAction("ExternalHttp")?.manifest().experimental).toBe(true);
    expect(discoverActionsForCapability("future.http")[0]?.name).toBe(
      "ExternalHttp"
    );
  });
});
