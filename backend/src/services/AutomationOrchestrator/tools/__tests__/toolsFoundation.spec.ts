import {
  AUTOMATION_AI_TOOLS_FEATURE_KEY,
  AUTOMATION_TOOL_DEFAULT_CAPABILITIES,
  isWriteSideEffect
} from "../../../../config/automationToolConstants";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../../../../config/automationOrchestratorConstants";
import {
  buildToolManifest,
  classifyToolError,
  defineTool,
  makeToolResult
} from "../contracts/ToolContract";
import {
  clearToolRegistry,
  discoverTools,
  getTool,
  listTools,
  listToolVersions,
  registerTool,
  validateToolManifest
} from "../ToolRegistry";
import { evaluateToolPolicy } from "../AutomationToolPolicyEngine";
import { runToolViaRuntime } from "../AutomationToolRuntime";
import { buildToolExecutionContext } from "../ToolExecutionContext";
import {
  validateToolSchema,
  toolSchemaToJsonSchema
} from "../schemaValidation";
import {
  buildToolAllowlist,
  resolveToolFromAllowlist,
  assertToolInAllowlist
} from "../ToolAllowlist";
import {
  buildToolIdempotencyKey
} from "../ToolIdempotency";
import {
  __resetToolCircuitBreakerForTests,
  isToolCircuitOpen,
  recordToolFailure,
  tripToolCircuit
} from "../ToolCircuitBreaker";
import {
  __resetToolRateLimitForTests,
  checkToolRateLimit
} from "../ToolRateLimit";
import {
  __resetToolMetricsForTests,
  getToolMetricsSnapshot,
  recordToolMetric
} from "../ToolMetrics";
import {
  __resetToolEventsForTests,
  emitToolEvent,
  getRecentToolEvents
} from "../ToolEventBus";
import {
  buildProviderToolDefinitions,
  toGeminiToolDefinition,
  toOpenAiToolDefinition
} from "../providers/buildProviderToolDefinitions";
import {
  registerBuiltinTools,
  resetBuiltinToolsRegistration
} from "../registerBuiltinTools";
import { sanitizeToolSnapshot } from "../sanitizeToolSnapshot";

function baseCtx(
  overrides: Partial<ReturnType<typeof buildToolExecutionContext>> = {}
) {
  return buildToolExecutionContext({
    companyId: 1,
    userId: 9,
    controlMode: "active",
    source: "admin_test",
    adminTestMode: true,
    executionOwner: "orchestrator",
    capabilities: {
      "tool.read": true,
      "tool.internal": true
    },
    permissions: ["aiTools.view", "aiTools.test", "aiTools.executeRead"],
    featureFlags: {
      [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
      [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true
    },
    requestId: "req-1",
    correlationId: "corr-1",
    ...overrides
  });
}

const companyPolicy = {
  enabled: true,
  maxRiskLevel: "read_only" as const,
  allowWrite: false,
  requireConfirmationFor: [],
  deniedToolIds: [],
  allowedToolIds: null
};

describe("Automation Tools 2.1A foundation", () => {
  beforeEach(() => {
    resetBuiltinToolsRegistration();
    clearToolRegistry();
    __resetToolCircuitBreakerForTests();
    __resetToolRateLimitForTests();
    __resetToolMetricsForTests();
    __resetToolEventsForTests();
    registerBuiltinTools();
  });

  it("buildToolManifest e validateToolManifest", () => {
    const m = buildToolManifest({
      id: "t.demo",
      name: "t.demo",
      category: "system",
      capabilities: ["tool.read"],
      riskLevel: "read_only",
      sideEffectType: "none"
    });
    expect(m.version).toBe("1.0.0");
    expect(validateToolManifest(m)).toEqual([]);
  });

  it("bloqueia write sem idempotência no manifest", () => {
    const m = buildToolManifest({
      id: "t.write",
      name: "t.write",
      category: "system",
      capabilities: ["tool.write"],
      riskLevel: "medium",
      sideEffectType: "database_write",
      idempotencyPolicy: { type: "none" }
    });
    expect(validateToolManifest(m)).toContain(
      "manifest.write_requires_idempotency"
    );
  });

  it("classifyToolError tipa erros", () => {
    expect(classifyToolError(new Error("TOOL_TIMEOUT")).type).toBe("timeout");
    expect(
      classifyToolError(new Error("TOOL_PERMISSION: denied")).type
    ).toBe("permission");
  });

  it("Registry registra versões e discovery", () => {
    expect(listTools({ includeExperimental: true }).length).toBeGreaterThanOrEqual(12);
    expect(getTool("system.echo")).toBeTruthy();
    expect(getTool("system.info")).toBeTruthy();
    expect(getTool("contact.search")).toBeTruthy();
    expect(listToolVersions("system.echo")).toContain("1.0.0");
    const discovered = discoverTools({
      ctx: baseCtx(),
      includeExperimental: true
    });
    expect(discovered.map(d => d.id)).toEqual(
      expect.arrayContaining([
        "system.echo",
        "system.context_summary",
        "system.health_check",
        "system.info",
        "contact.search"
      ])
    );
  });

  it("duplicidade de versão é rejeitada", () => {
    expect(() => registerTool(getTool("system.echo")!)).toThrow(/duplicate/);
  });

  it("schema input/output validation", () => {
    const schema = {
      type: "object" as const,
      additionalProperties: false,
      fields: [
        { name: "message", type: "string" as const, required: true, maxLength: 10 }
      ]
    };
    expect(validateToolSchema(schema, { message: "ok" }, "input")).toEqual([]);
    expect(
      validateToolSchema(schema, {}, "input")[0]
    ).toContain("missing:message");
    expect(
      validateToolSchema(schema, { message: "abcdefghijk" }, "input")[0]
    ).toContain("maxLength");
    const json = toolSchemaToJsonSchema(schema);
    expect(json.type).toBe("object");
    expect((json.required as string[]).includes("message")).toBe(true);
  });

  it("allowlist discovery seguro", () => {
    const list = buildToolAllowlist([
      getTool("system.echo")!.manifest(),
      getTool("system.health_check")!.manifest()
    ]);
    expect(
      resolveToolFromAllowlist({
        requestedId: "system.echo",
        requestedVersion: "1.0.0",
        allowlist: list
      })?.key
    ).toBe("system.echo@1.0.0");
    expect(
      resolveToolFromAllowlist({
        requestedId: "system.unknown",
        allowlist: list
      })
    ).toBeNull();
    expect(() =>
      assertToolInAllowlist({
        toolId: "system.echo",
        toolVersion: "1.0.0",
        allowedToolKeys: ["other@1"]
      })
    ).toThrow(/allowlist/);
  });

  it("Policy: observe não executa", () => {
    const decision = evaluateToolPolicy({
      manifest: getTool("system.echo")!.manifest(),
      ctx: baseCtx({ controlMode: "observe", source: "action" }),
      companyPolicy
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("observe_no_execution");
  });

  it("Policy: shadow bloqueia side effect de escrita", () => {
    const writeTool = defineTool(
      {
        id: "tmp.write",
        name: "tmp.write",
        category: "system",
        capabilities: ["tool.write"],
        riskLevel: "medium",
        sideEffectType: "database_write",
        supportsShadow: true,
        idempotencyPolicy: { type: "request", persistentUniqueness: true }
      },
      {
        execute: async () => makeToolResult({ status: "success" })
      }
    );
    const decision = evaluateToolPolicy({
      manifest: writeTool.manifest(),
      ctx: baseCtx({
        controlMode: "shadow_execute",
        source: "action",
        adminTestMode: false
      }),
      companyPolicy: { ...companyPolicy, allowWrite: true, maxRiskLevel: "critical" }
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/shadow/);
  });

  it("Policy: feature e permission denial", () => {
    const m = getTool("system.echo")!.manifest();
    expect(
      evaluateToolPolicy({
        manifest: m,
        ctx: baseCtx({
          featureFlags: {
            [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: false,
            [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true
          }
        }),
        companyPolicy
      }).reason
    ).toMatch(/feature_missing/);

    expect(
      evaluateToolPolicy({
        manifest: m,
        ctx: baseCtx({ permissions: [] }),
        companyPolicy
      }).reason
    ).toBe("permission_denied");
  });

  it("Policy: active_partial exige capability ativa", () => {
    const decision = evaluateToolPolicy({
      manifest: getTool("system.echo")!.manifest(),
      ctx: baseCtx({
        controlMode: "active_partial",
        source: "action",
        adminTestMode: false,
        capabilities: { "tool.read": false, "tool.internal": false }
      }),
      companyPolicy
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("active_partial_capability_inactive");
  });

  it("Policy: escrita sem confirmação quando exigida", () => {
    const writeTool = defineTool(
      {
        id: "tmp.confirm",
        name: "tmp.confirm",
        category: "system",
        capabilities: ["tool.write"],
        riskLevel: "high",
        sideEffectType: "database_write",
        requiresConfirmation: "admin_only",
        idempotencyPolicy: { type: "request" }
      },
      { execute: async () => makeToolResult({ status: "success" }) }
    );
    const decision = evaluateToolPolicy({
      manifest: writeTool.manifest(),
      ctx: baseCtx({
        source: "action",
        adminTestMode: false,
        controlMode: "active"
      }),
      companyPolicy: {
        ...companyPolicy,
        allowWrite: true,
        maxRiskLevel: "critical"
      }
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("confirmation_required");
  });

  it("Policy: escrita sem allowWrite é deny", () => {
    const writeTool = defineTool(
      {
        id: "tmp.nowrite",
        name: "tmp.nowrite",
        category: "system",
        capabilities: ["tool.write"],
        riskLevel: "medium",
        sideEffectType: "database_write",
        idempotencyPolicy: { type: "request" }
      },
      { execute: async () => makeToolResult({ status: "success" }) }
    );
    expect(
      evaluateToolPolicy({
        manifest: writeTool.manifest(),
        ctx: baseCtx({ source: "action", adminTestMode: false }),
        companyPolicy: { ...companyPolicy, maxRiskLevel: "critical" }
      }).reason
    ).toBe("write_not_explicitly_allowed");
  });

  it("Runtime: system.echo sucesso", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.echo",
      ctx: baseCtx(),
      input: { message: "ping" },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    expect(result.data.echo).toBe("ping");
    expect(result.errors).toEqual([]);
  });

  it("Runtime: system.context_summary sanitizado", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.context_summary",
      ctx: baseCtx({
        metadata: { apiKey: "secret", token: "x" }
      }),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    expect(result.data.companyId).toBe(1);
    expect(JSON.stringify(result.data)).not.toMatch(/secret/);
  });

  it("Runtime: system.health_check", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.health_check",
      ctx: baseCtx(),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    expect(result.data.ok).toBe(true);
  });

  it("Runtime: observe retorna skipped", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.echo",
      ctx: baseCtx({ controlMode: "observe", source: "action", adminTestMode: false }),
      input: { message: "x" },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("skipped");
  });

  it("Runtime: schema inválido falha", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.echo",
      ctx: baseCtx(),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("failure");
    expect(result.errors[0]?.type).toBe("validation");
  });

  it("Runtime: tenant inválido", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.echo",
      ctx: baseCtx({ companyId: 0 as unknown as number }),
      input: { message: "x" },
      companyPolicy,
      persist: false
    });
    expect(["denied", "failure"]).toContain(result.status);
  });

  it("Runtime: ai_function_call fora da allowlist", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.echo",
      ctx: baseCtx({
        source: "ai_function_call",
        allowedToolKeys: ["other@1.0.0"],
        adminTestMode: false
      }),
      input: { message: "x" },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("denied");
  });

  it("Runtime: fontes não produtivas negadas", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.echo",
      ctx: baseCtx({ source: "planner", adminTestMode: false }),
      input: { message: "x" },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("denied");
  });

  it("idempotency key por request", () => {
    const key = buildToolIdempotencyKey({
      policy: { type: "request" },
      companyId: 1,
      toolId: "system.echo",
      toolVersion: "1.0.0",
      ctx: baseCtx()
    });
    expect(key).toBeTruthy();
    expect(key!.length).toBe(64);
  });

  it("rate limit", () => {
    const policy = { maxCalls: 2, windowSeconds: 60, scope: "company" as const };
    expect(
      checkToolRateLimit({ policy, ctx: baseCtx(), toolId: "system.echo" })
        .allowed
    ).toBe(true);
    expect(
      checkToolRateLimit({ policy, ctx: baseCtx(), toolId: "system.echo" })
        .allowed
    ).toBe(true);
    expect(
      checkToolRateLimit({ policy, ctx: baseCtx(), toolId: "system.echo" })
        .allowed
    ).toBe(false);
  });

  it("circuit breaker por tool", () => {
    for (let i = 0; i < 5; i += 1) {
      recordToolFailure(1, "system.echo", "1.0.0", "failure");
    }
    expect(isToolCircuitOpen(1, "system.echo", "1.0.0")).toBe(true);
    expect(isToolCircuitOpen(1, "system.health_check", "1.0.0")).toBe(false);
    tripToolCircuit(1, "system.context_summary", "1.0.0", "manual");
    expect(isToolCircuitOpen(1, "system.context_summary", "1.0.0")).toBe(true);
  });

  it("metrics automáticas", () => {
    recordToolMetric({
      companyId: 1,
      toolId: "system.echo",
      toolVersion: "1.0.0",
      source: "admin_test",
      riskLevel: "read_only",
      sideEffectType: "none",
      status: "success",
      durationMs: 12
    });
    const snap = getToolMetricsSnapshot(1);
    expect(snap.toolExecutions).toBe(1);
    expect(snap.toolSuccesses).toBe(1);
    expect(snap.averageToolDuration).toBe(12);
  });

  it("event bus interno", async () => {
    await emitToolEvent({
      companyId: 1,
      eventName: "ToolDiscovered",
      toolId: "system.echo",
      payload: { apiKey: "should-strip", count: 1 }
    });
    const events = getRecentToolEvents(1);
    expect(events.length).toBe(1);
    expect(JSON.stringify(events[0].payload)).not.toMatch(/should-strip/);
  });

  it("audit sanitization remove secrets e limita tamanho", () => {
    const cleaned = sanitizeToolSnapshot({
      message: "ok",
      apiKey: "abc",
      token: "xyz",
      password: "p"
    });
    expect(cleaned.message).toBe("ok");
    expect(cleaned.apiKey).toBeUndefined();
    expect(cleaned.token).toBeUndefined();
  });

  it("provider schema adapters (sem dispatch)", () => {
    const tools = listTools({ includeExperimental: true });
    const defs = buildProviderToolDefinitions(tools);
    // Tools técnicas têm exposeToModel=false
    expect(defs.openai).toEqual([]);
    expect(defs.gemini).toEqual([]);
    expect(defs.allowlist).toEqual([]);

    const exposed = buildToolManifest({
      id: "future.demo",
      name: "future.demo",
      category: "future",
      capabilities: ["tool.read"],
      riskLevel: "read_only",
      sideEffectType: "none",
      exposeToModel: true,
      inputSchema: {
        type: "object",
        fields: [{ name: "q", type: "string", required: true }],
        additionalProperties: false
      }
    });
    const openai = toOpenAiToolDefinition(exposed);
    expect(openai.type).toBe("function");
    expect(openai.function.name).toBe("future_demo");
    const gemini = toGeminiToolDefinition(exposed);
    expect(gemini.name).toBe("future_demo");
    const withExposed = buildProviderToolDefinitions([exposed]);
    expect(withExposed.allowlist[0].key).toBe("future.demo@1.0.0");
  });

  it("capabilities default deny", () => {
    expect(AUTOMATION_TOOL_DEFAULT_CAPABILITIES["tool.write"]).toBe(false);
    expect(AUTOMATION_TOOL_DEFAULT_CAPABILITIES["message.send"]).toBe(false);
  });

  it("Write Tools registradas via Operation Runtime (2.1C)", () => {
    const tools = listTools({ includeExperimental: true });
    const writes = tools.filter(t => t.sideEffectType === "database_write");
    expect(writes.length).toBe(5);
    expect(writes.every(t => t.metadata?.operationRuntime === true)).toBe(true);
    expect(tools.some(t => t.id === "message.send")).toBe(false);
    expect(tools.some(t => t.id === "contact.update_allowed_fields")).toBe(true);
  });

  it("isWriteSideEffect classificação", () => {
    expect(isWriteSideEffect("none")).toBe(false);
    expect(isWriteSideEffect("database_read")).toBe(false);
    expect(isWriteSideEffect("database_write")).toBe(true);
    expect(isWriteSideEffect("message_send")).toBe(true);
  });

  it("supportsDiscovery separado de validateExecutionContext", async () => {
    let validated = false;
    const tool = defineTool(
      {
        id: "tmp.sep",
        name: "tmp.sep",
        category: "system",
        capabilities: ["tool.read"],
        riskLevel: "read_only",
        sideEffectType: "none",
        requiredPermissions: ["aiTools.test"],
        outputSchema: {
          type: "object",
          additionalProperties: false,
          fields: [{ name: "ok", type: "boolean", required: true }]
        }
      },
      {
        supportsDiscovery: () => false,
        validateExecutionContext: () => {
          validated = true;
        },
        execute: async () =>
          makeToolResult({ status: "success", data: { ok: true } })
      }
    );
    registerTool(tool);
    expect(
      discoverTools({ ctx: baseCtx(), includeExperimental: true }).map(
        t => t.id
      )
    ).not.toContain("tmp.sep");

    const denied = await runToolViaRuntime({
      toolId: "tmp.sep",
      tool,
      ctx: baseCtx({ permissions: [] }),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(denied.status).toBe("denied");

    const ok = await runToolViaRuntime({
      toolId: "tmp.sep",
      tool,
      ctx: baseCtx(),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(ok.status).toBe("success");
    expect(validated).toBe(true);
  });

  it("timeout via runtime", async () => {
    const slow = defineTool(
      {
        id: "tmp.slow",
        name: "tmp.slow",
        category: "system",
        capabilities: ["tool.read"],
        riskLevel: "read_only",
        sideEffectType: "none",
        requiredPermissions: ["aiTools.test"],
        timeoutPolicy: { timeoutMs: 50 }
      },
      {
        execute: async () => {
          await new Promise(r => setTimeout(r, 200));
          return makeToolResult({ status: "success" });
        }
      }
    );
    registerTool(slow);
    const result = await runToolViaRuntime({
      toolId: "tmp.slow",
      tool: slow,
      ctx: baseCtx(),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("failure");
    expect(result.metrics.timedOut).toBe(true);
  });
});
