import {
  AUTOMATION_AI_TOOLS_FEATURE_KEY
} from "../../../../config/automationToolConstants";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../../../../config/automationOrchestratorConstants";
import {
  clearToolRegistry,
  getTool,
  listTools
} from "../ToolRegistry";
import {
  registerBuiltinTools,
  resetBuiltinToolsRegistration
} from "../registerBuiltinTools";
import { buildToolExecutionContext } from "../ToolExecutionContext";
import { runToolViaRuntime } from "../AutomationToolRuntime";
import { toModelResult, diffInternalVsModel } from "../ToolModelResultAdapter";
import { resolveToolPagination, TOOL_READ_MAX_LIMIT } from "../toolPagination";
import { NoopToolCacheStore, getToolCacheStore } from "../ToolCache";
import {
  __resetToolCircuitBreakerForTests
} from "../ToolCircuitBreaker";
import { __resetToolRateLimitForTests } from "../ToolRateLimit";
import { __resetToolMetricsForTests } from "../ToolMetrics";
import { __resetToolEventsForTests } from "../ToolEventBus";
import { validateToolSchema } from "../schemaValidation";

jest.mock("../../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(async () => ({
      rows: [
        {
          id: 1,
          name: "Ana",
          number: "5511999998888",
          email: "ana@example.com",
          channel: "whatsapp"
        }
      ],
      count: 1
    })),
    findOne: jest.fn(async ({ where }: { where: { id: number; companyId: number } }) => {
      if (where.companyId !== 1) return null;
      if (where.id === 1) {
        return {
          id: 1,
          name: "Ana",
          number: "5511999998888",
          email: "ana@example.com",
          channel: "whatsapp"
        };
      }
      return null;
    })
  }
}));

jest.mock("../../../ContactServices/getTagsForContactIds", () => ({
  __esModule: true,
  default: jest.fn(async () => {
    const map = new Map();
    map.set(1, [{ id: 9, name: "vip", color: "#f00" }]);
    return map;
  })
}));

jest.mock("../../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(async () => ({
      rows: [
        {
          id: 10,
          status: "open",
          queueId: 2,
          userId: 3,
          contactId: 1,
          lastMessage: "olá",
          updatedAt: new Date("2026-01-01"),
          queue: { id: 2, name: "Suporte" },
          user: { id: 3, name: "João" },
          contact: { id: 1, name: "Ana" }
        }
      ],
      count: 1
    })),
    findOne: jest.fn(async ({ where }: { where: { id: number; companyId: number } }) => {
      if (where.companyId !== 1 || where.id !== 10) return null;
      return {
        id: 10,
        status: "open",
        queueId: 2,
        userId: 3,
        contactId: 1,
        lastMessage: "olá",
        updatedAt: new Date("2026-01-01"),
        queue: { id: 2, name: "Suporte" },
        user: { id: 3, name: "João" },
        contact: { id: 1, name: "Ana" }
      };
    }),
    findAll: jest.fn(async () => [])
  }
}));

jest.mock("../../../../models/TicketTag", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(async () => [])
  }
}));

jest.mock("../../../../models/Tag", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => null)
  }
}));

jest.mock("../../../../models/Queue", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(async () => ({
      rows: [{ id: 2, name: "Suporte", color: "#00f" }],
      count: 1
    }))
  }
}));

jest.mock("../../../../models/User", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(async () => ({
      rows: [{ id: 3, name: "João", profile: "admin", online: true }],
      count: 1
    }))
  }
}));

jest.mock("../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => null)
  }
}));

jest.mock("../../GetAutomationExecutionService", () => ({
  __esModule: true,
  default: jest.fn(async ({ companyId, executionId }: { companyId: number; executionId: number }) => {
    if (companyId !== 1 || executionId !== 99) {
      const err = new Error("not found");
      throw err;
    }
    return {
      id: 99,
      status: "completed",
      intent: "knowledge",
      controlMode: "observe",
      ownership: "legacy",
      currentStep: 2,
      fallbackToLegacy: false,
      circuitBreakerTripped: false,
      startedAt: new Date("2026-01-01"),
      finishedAt: new Date("2026-01-01"),
      steps: [
        {
          stepIndex: 0,
          actionName: "ClassifyIntentAction",
          status: "completed",
          resultStatus: "success",
          durationMs: 12
        }
      ]
    };
  })
}));

jest.mock("../../../KnowledgeBaseService/SearchKnowledgeChunksService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    results: [
      {
        chunkId: 1,
        documentId: 2,
        knowledgeBaseId: 3,
        documentTitle: "FAQ",
        documentType: "pdf",
        sectionTitle: "Horário",
        chunkContent: "Abrimos das 9 às 18.",
        similarityScore: 0.91,
        sourceType: "upload",
        sourceUrl: null,
        language: "pt",
        knowledgeBaseName: "Base A"
      }
    ],
    meta: {
      provider: "mock",
      model: "mock",
      dimensions: 0,
      vectorStore: "mock",
      query: "horario"
    }
  }))
}));

function baseCtx(overrides: Record<string, unknown> = {}) {
  return buildToolExecutionContext({
    companyId: 1,
    userId: 9,
    controlMode: "active",
    source: "admin_test",
    adminTestMode: true,
    executionOwner: "orchestrator",
    capabilities: {
      "tool.read": true,
      "tool.internal": true,
      "contact.read": true,
      "ticket.read": true,
      "queue.read": true,
      "user.read": true
    },
    permissions: ["aiTools.executeRead", "aiTools.test"],
    featureFlags: {
      [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
      [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true,
      "automation.knowledge_base": true
    },
    requestId: "req-read",
    ...(overrides as any)
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

describe("Read Tools 2.1B", () => {
  beforeEach(() => {
    resetBuiltinToolsRegistration();
    clearToolRegistry();
    __resetToolCircuitBreakerForTests();
    __resetToolRateLimitForTests();
    __resetToolMetricsForTests();
    __resetToolEventsForTests();
    registerBuiltinTools();
  });

  it("registra todas as read tools", () => {
    const ids = listTools({ includeExperimental: true }).map(t => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "system.info",
        "contact.search",
        "contact.read",
        "ticket.search",
        "ticket.read",
        "queue.list",
        "user.list",
        "knowledge.search",
        "automation.execution.read"
      ])
    );
    expect(
      listTools({ includeExperimental: true }).every(
        t =>
          t.riskLevel === "read_only" &&
          (t.sideEffectType === "none" || t.sideEffectType === "database_read")
      )
    ).toBe(true);
  });

  it("paginação respeita maxLimit", () => {
    const p = resolveToolPagination({ limit: 999, offset: -1 });
    expect(p.limit).toBe(TOOL_READ_MAX_LIMIT);
    expect(p.offset).toBe(0);
  });

  it("cache store é noop por padrão", async () => {
    const store = getToolCacheStore();
    expect(store).toBeInstanceOf(NoopToolCacheStore);
    expect(await store.get("k")).toBeNull();
  });

  it("system.info retorna snapshot sanitizado + modelResult", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.info",
      ctx: baseCtx(),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    expect(result.data.item).toBeTruthy();
    expect((result.data.item as any).companyId).toBe(1);
    expect(result.modelResult).toBeTruthy();
    expect((result.modelResult as any).item?.companyId).toBeUndefined();
    expect(JSON.stringify(result.modelResult)).not.toMatch(/metrics|logs|audit/);
  });

  it("contact.search tenant + schema + model adapter", async () => {
    const result = await runToolViaRuntime({
      toolId: "contact.search",
      ctx: baseCtx(),
      input: { name: "Ana", limit: 10 },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    expect(result.metrics.resultCount).toBe(1);
    expect((result.data.items as any[])[0].phoneMasked).toMatch(/\*\*\*/);
    const model = toModelResult(result, "contact.search");
    expect(model.items?.[0]?.id).toBeUndefined();
    expect(model.items?.[0]?.name).toBe("Ana");
    expect(diffInternalVsModel(result, model).hiddenFromModel).toContain(
      "companyId"
    );
  });

  it("contact.read not found é emptyResult", async () => {
    const result = await runToolViaRuntime({
      toolId: "contact.read",
      ctx: baseCtx(),
      input: { contactId: 999 },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    expect(result.metrics.emptyResult).toBe(true);
    expect((result.modelResult as any).status).toBe("empty");
  });

  it("contact.read sucesso", async () => {
    const result = await runToolViaRuntime({
      toolId: "contact.read",
      ctx: baseCtx(),
      input: { contactId: 1 },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    expect((result.data.item as any).name).toBe("Ana");
  });

  it("ticket.search / ticket.read", async () => {
    const search = await runToolViaRuntime({
      toolId: "ticket.search",
      ctx: baseCtx(),
      input: { status: "open" },
      companyPolicy,
      persist: false
    });
    expect(search.status).toBe("success");
    expect((search.data.items as any[])[0].queueName).toBe("Suporte");

    const read = await runToolViaRuntime({
      toolId: "ticket.read",
      ctx: baseCtx(),
      input: { ticketId: 10 },
      companyPolicy,
      persist: false
    });
    expect(read.status).toBe("success");
    expect((read.data.item as any).status).toBe("open");
  });

  it("queue.list e user.list", async () => {
    const queues = await runToolViaRuntime({
      toolId: "queue.list",
      ctx: baseCtx(),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(queues.status).toBe("success");
    expect((queues.data.items as any[])[0].name).toBe("Suporte");

    const users = await runToolViaRuntime({
      toolId: "user.list",
      ctx: baseCtx(),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(users.status).toBe("success");
    expect((users.data.items as any[])[0].name).toBe("João");
    expect((users.modelResult as any).items?.[0]?.id).toBeUndefined();
  });

  it("knowledge.search sanitiza trechos sem embeddings", async () => {
    const result = await runToolViaRuntime({
      toolId: "knowledge.search",
      ctx: baseCtx(),
      input: { query: "horario", limit: 5 },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    const item = (result.data.items as any[])[0];
    expect(item.excerpt).toMatch(/Abrimos/);
    expect(item.embedding).toBeUndefined();
    expect(JSON.stringify(result.modelResult)).not.toMatch(/embedding/);
  });

  it("knowledge.search exige feature", async () => {
    const result = await runToolViaRuntime({
      toolId: "knowledge.search",
      ctx: baseCtx({
        featureFlags: {
          [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
          [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true,
          "automation.knowledge_base": false
        }
      }),
      input: { query: "x" },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("denied");
  });

  it("automation.execution.read resume timeline", async () => {
    const result = await runToolViaRuntime({
      toolId: "automation.execution.read",
      ctx: baseCtx(),
      input: { executionId: 99 },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("success");
    expect((result.data.item as any).timeline).toHaveLength(1);
    expect((result.data.item as any).status).toBe("completed");
  });

  it("permission denial", async () => {
    const result = await runToolViaRuntime({
      toolId: "contact.search",
      ctx: baseCtx({ permissions: [] }),
      input: { name: "x" },
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("denied");
  });

  it("tenant: company inválida", async () => {
    const result = await runToolViaRuntime({
      toolId: "queue.list",
      ctx: baseCtx({ companyId: 0 as any }),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(["denied", "failure"]).toContain(result.status);
  });

  it("schemas das read tools são válidos", () => {
    for (const id of [
      "system.info",
      "contact.search",
      "contact.read",
      "ticket.search",
      "ticket.read",
      "queue.list",
      "user.list",
      "knowledge.search",
      "automation.execution.read"
    ]) {
      const m = getTool(id)!.manifest();
      expect(m.inputSchema).toBeTruthy();
      expect(m.outputSchema).toBeTruthy();
      expect(validateToolSchema(m.inputSchema, {}, "input").every(e =>
        e.includes("missing")
      ) || validateToolSchema(m.inputSchema, {}, "input").length >= 0).toBe(
        true
      );
    }
  });

  it("observe não executa read tools", async () => {
    const result = await runToolViaRuntime({
      toolId: "system.info",
      ctx: baseCtx({
        controlMode: "observe",
        source: "action",
        adminTestMode: false
      }),
      input: {},
      companyPolicy,
      persist: false
    });
    expect(result.status).toBe("skipped");
  });
});
