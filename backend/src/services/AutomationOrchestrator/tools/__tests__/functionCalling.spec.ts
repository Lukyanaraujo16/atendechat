/**
 * Fase 2.1D — Function Calling (Selection / Adapter / Resolver)
 */
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
import { selectToolsForFunctionCalling } from "../functionCalling/AutomationToolSelectionEngine";
import { buildProviderToolPayload } from "../functionCalling/AutomationProviderToolAdapter";
import {
  buildSimulatorToolContext,
  buildFunctionCallingToolContext,
  hashToolCall,
  resolveProviderToolCall
} from "../functionCalling/AutomationFunctionCallResolver";
import {
  __resetFunctionCallingMetricsForTests,
  getFunctionCallingMetricsSnapshot
} from "../functionCalling/FunctionCallingMetrics";
import { buildToolExecutionContext } from "../ToolExecutionContext";
import { __resetToolCircuitBreakerForTests } from "../ToolCircuitBreaker";
import { __resetToolRateLimitForTests } from "../ToolRateLimit";
import { __resetToolMetricsForTests } from "../ToolMetrics";
import { __resetToolEventsForTests } from "../ToolEventBus";
import {
  toOpenAiToolDefinition,
  toGeminiToolDefinition
} from "../providers/buildProviderToolDefinitions";

jest.mock("../../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(async () => ({
      rows: [{ id: 1, name: "Ana", number: "5511", email: "a@b.com", channel: "whatsapp" }],
      count: 1
    })),
    findOne: jest.fn(async () => ({
      id: 1,
      name: "Ana",
      number: "5511",
      email: "a@b.com",
      channel: "whatsapp"
    }))
  }
}));

jest.mock("../../../ContactServices/getTagsForContactIds", () => ({
  __esModule: true,
  default: jest.fn(async () => new Map())
}));

jest.mock("../../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(async () => ({ rows: [], count: 0 })),
    findOne: jest.fn(async () => null)
  }
}));

jest.mock("../../../../models/Queue", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(async () => ({
      rows: [{ id: 2, name: "Suporte" }],
      count: 1
    }))
  }
}));

jest.mock("../../../../models/User", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(async () => ({ rows: [], count: 0 }))
  }
}));

jest.mock("../../../../models/TicketTag", () => ({
  __esModule: true,
  default: { findAll: jest.fn(async () => []) }
}));

jest.mock("../../../../models/Tag", () => ({
  __esModule: true,
  default: { findAll: jest.fn(async () => []) }
}));

jest.mock("../../../../models/Message", () => ({
  __esModule: true,
  default: { findAll: jest.fn(async () => []) }
}));

jest.mock("../../GetAutomationExecutionService", () => ({
  __esModule: true,
  default: jest.fn(async () => null)
}));

jest.mock("../../../KnowledgeBaseService/SearchKnowledgeChunksService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({ chunks: [], maxScore: 0 }))
}));

jest.mock("../../../../libs/cache", () => ({
  setNx: jest.fn(async () => true),
  del: jest.fn(async () => undefined),
  get: jest.fn(async () => null),
  set: jest.fn(async () => undefined)
}));

function fcCtx() {
  return buildSimulatorToolContext({
    companyId: 1,
    userId: 9,
    allowedToolKeys: [],
    featureFlags: {
      [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
      [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true,
      "automation.knowledge_base": true
    }
  });
}

describe("Function Calling 2.1D", () => {
  beforeEach(() => {
    resetBuiltinToolsRegistration();
    clearToolRegistry();
    __resetToolCircuitBreakerForTests();
    __resetToolRateLimitForTests();
    __resetToolMetricsForTests();
    __resetToolEventsForTests();
    __resetFunctionCallingMetricsForTests();
    registerBuiltinTools();
  });

  it("Read Tools têm exposeToModel; Write Tools não", () => {
    const tools = listTools({ includeExperimental: true });
    const reads = tools.filter(t => t.riskLevel === "read_only" && t.id.startsWith("contact."));
    expect(reads.every(t => t.exposeToModel === true)).toBe(true);
    const writes = tools.filter(t => t.sideEffectType === "database_write");
    expect(writes.every(t => t.exposeToModel === false)).toBe(true);
  });

  it("Selection Engine retorna só elegíveis", () => {
    const selection = selectToolsForFunctionCalling({
      ctx: fcCtx(),
      origin: "simulator",
      provider: "openai",
      companyPolicy: { enabled: true, maxRiskLevel: "read_only", allowWrite: false }
    });
    expect(selection.tools.length).toBeGreaterThan(0);
    expect(selection.tools.every(t => t.exposeToModel)).toBe(true);
    expect(selection.tools.every(t => t.sideEffectType !== "database_write")).toBe(
      true
    );
    expect(selection.tools.some(t => t.id === "ticket.transfer")).toBe(false);
    expect(selection.allowedToolKeys.length).toBe(selection.tools.length);
  });

  it("Selection filtra por categoria do planner", () => {
    const selection = selectToolsForFunctionCalling({
      ctx: fcCtx(),
      origin: "simulator",
      provider: "openai",
      plannerCategories: ["contact"],
      companyPolicy: { enabled: true, maxRiskLevel: "read_only" }
    });
    expect(selection.tools.every(t => t.id.startsWith("contact."))).toBe(true);
  });

  it("Selection rejeita origin live", () => {
    const selection = selectToolsForFunctionCalling({
      ctx: fcCtx(),
      origin: "live" as any,
      provider: "openai"
    });
    expect(selection.tools.length).toBe(0);
  });

  it("Selection aceita origin shadow", () => {
    const selection = selectToolsForFunctionCalling({
      ctx: buildFunctionCallingToolContext({
        companyId: 1,
        allowedToolKeys: [],
        source: "shadow",
        featureFlags: {
          [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
          [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true,
          "automation.knowledge_base": true
        }
      }),
      origin: "shadow",
      provider: "openai",
      companyPolicy: { enabled: true, maxRiskLevel: "read_only" }
    });
    expect(selection.tools.length).toBeGreaterThan(0);
  });

  it("Provider Adapter OpenAI e Gemini", () => {
    const selection = selectToolsForFunctionCalling({
      ctx: fcCtx(),
      origin: "simulator",
      provider: "openai",
      companyPolicy: { enabled: true, maxRiskLevel: "read_only" }
    });
    const openai = buildProviderToolPayload({
      manifests: selection.tools,
      provider: "openai"
    });
    expect(openai.providerPayload.openaiTools?.length).toBe(
      selection.tools.length
    );
    const gemini = buildProviderToolPayload({
      manifests: selection.tools,
      provider: "gemini"
    });
    expect(gemini.providerPayload.geminiFunctionDeclarations?.length).toBe(
      selection.tools.length
    );
    const claude = buildProviderToolPayload({
      manifests: selection.tools,
      provider: "claude"
    });
    expect(claude.definitions.allowlist.length).toBe(0);

    const sample = selection.tools[0];
    expect(toOpenAiToolDefinition(sample).type).toBe("function");
    expect(toGeminiToolDefinition(sample).name).toContain("_");
  });

  it("Resolver nega Tool fora da allowlist", async () => {
    const selection = selectToolsForFunctionCalling({
      ctx: fcCtx(),
      origin: "simulator",
      provider: "openai",
      companyPolicy: { enabled: true, maxRiskLevel: "read_only" }
    });
    const ctx = {
      ...fcCtx(),
      allowedToolKeys: selection.allowedToolKeys
    };
    const denied = await resolveProviderToolCall({
      call: {
        id: "1",
        name: "ticket_transfer",
        arguments: { ticketId: 1 }
      },
      ctx,
      allowlist: selection.allowlist
    });
    expect(denied.status).toBe("denied");
    expect(denied.error).toMatch(/allowlist/);
  });

  it("Resolver executa Tool read via Runtime", async () => {
    const selection = selectToolsForFunctionCalling({
      ctx: fcCtx(),
      origin: "simulator",
      provider: "openai",
      plannerCategories: ["queue"],
      companyPolicy: { enabled: true, maxRiskLevel: "read_only" }
    });
    expect(selection.tools.some(t => t.id === "queue.list")).toBe(true);
    const ctx = {
      ...fcCtx(),
      allowedToolKeys: selection.allowedToolKeys
    };
    const ok = await resolveProviderToolCall({
      call: {
        id: "2",
        name: "queue_list",
        arguments: { limit: 10 }
      },
      ctx,
      allowlist: selection.allowlist,
      persist: false
    });
    expect(ok.status).toBe("success");
    expect(ok.modelResult).toBeTruthy();
    expect(JSON.stringify(ok.modelResult)).not.toMatch(/companyId|transactionId|audit/);
  });

  it("Resolver rejeita argumentos inválidos", async () => {
    const selection = selectToolsForFunctionCalling({
      ctx: fcCtx(),
      origin: "simulator",
      provider: "openai",
      plannerCategories: ["contact"],
      companyPolicy: { enabled: true, maxRiskLevel: "read_only" }
    });
    const contactRead = selection.tools.find(t => t.id === "contact.read");
    expect(contactRead).toBeTruthy();
    const ctx = {
      ...fcCtx(),
      allowedToolKeys: selection.allowedToolKeys
    };
    const bad = await resolveProviderToolCall({
      call: {
        id: "3",
        name: "contact_read",
        arguments: "not-json"
      },
      ctx,
      allowlist: selection.allowlist
    });
    expect(bad.status).toBe("invalid");
  });

  it("hashToolCall detecta repetição", () => {
    const a = hashToolCall("queue.list", { limit: 10 });
    const b = hashToolCall("queue.list", { limit: 10 });
    const c = hashToolCall("queue.list", { limit: 5 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("métricas FC registram seleção", () => {
    const selection = selectToolsForFunctionCalling({
      ctx: fcCtx(),
      origin: "simulator",
      provider: "openai",
      companyPolicy: { enabled: true, maxRiskLevel: "read_only" }
    });
    const { recordFunctionCallingSelection } = require("../functionCalling/FunctionCallingMetrics");
    recordFunctionCallingSelection({
      companyId: 1,
      selectedIds: selection.tools.map((t: { id: string }) => t.id),
      availableCount: selection.tools.length
    });
    const snap = getFunctionCallingMetricsSnapshot(1);
    expect(snap.selectedTools).toBeGreaterThan(0);
  });

  it("system.echo permanece não exposto", () => {
    expect(getTool("system.echo")!.manifest().exposeToModel).toBe(false);
  });
});
