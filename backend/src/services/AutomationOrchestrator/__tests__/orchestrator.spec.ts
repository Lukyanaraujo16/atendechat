jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock("../../../models/AutomationExecution", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/AutomationExecutionStep", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../models/AutomationExecutionEvent", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/AutomationOrchestratorSettings", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/AutomationPlannerValidation", () => ({
  __esModule: true,
  default: {
    create: jest.fn().mockResolvedValue({ id: 1, matched: true }),
    findAll: jest.fn().mockResolvedValue([]),
    findAndCountAll: jest.fn()
  }
}));

jest.mock("../../AiAgentService/isFlowAutomationActive", () => ({
  isFlowAutomationActive: jest.fn((ticket: { flowWebhook?: boolean; flowStopped?: unknown }) => {
    const hasFlowId =
      ticket.flowStopped != null &&
      String(ticket.flowStopped).trim() !== "" &&
      String(ticket.flowStopped).trim() !== "0";
    if (ticket.flowWebhook === true && hasFlowId) {
      return { active: true, reason: "flow_webhook_active" };
    }
    return { active: false };
  })
}));

jest.mock("../../AiAgentService/aiAgentRuntimeMode", () => ({
  resolveWhatsappAiAgentRuntimeMode: jest.fn(
    (whatsapp: { aiAgentMode?: string; aiAgentEnabled?: boolean; aiAgentId?: number }) => {
      if (whatsapp.aiAgentMode === "live" || whatsapp.aiAgentMode === "shadow") {
        return whatsapp.aiAgentMode;
      }
      if (whatsapp.aiAgentEnabled && whatsapp.aiAgentId) return "dry_run";
      return "disabled";
    }
  )
}));

import AutomationExecution from "../../../models/AutomationExecution";
import AutomationExecutionStep from "../../../models/AutomationExecutionStep";
import AutomationExecutionEvent from "../../../models/AutomationExecutionEvent";
import AppError from "../../../errors/AppError";
import { classifyIntent } from "../classifyIntent";
import { planAutomation } from "../AutomationPlanner";
import {
  clearActionRegistry,
  listActions,
  registerAction,
  getAction
} from "../ActionRegistry";
import { defineAction } from "../AutomationActionRuntime";
import {
  registerBuiltinActions,
  resetBuiltinActionsRegistration
} from "../registerBuiltinActions";
import { sanitizeAutomationPayload } from "../sanitizeAutomationPayload";
import { runAutomationExecution } from "../AutomationExecutionEngine";
import { StartAutomationExecutionService } from "../StartAutomationExecutionService";
import GetAutomationExecutionService from "../GetAutomationExecutionService";
import { ExecutionContext } from "../types";
import { AUTOMATION_DEFAULT_CONTROL_MODE } from "../../../config/automationOrchestratorConstants";

const mockedExecution = AutomationExecution as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

const mockedStep = AutomationExecutionStep as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
};

const mockedEvent = AutomationExecutionEvent as unknown as {
  create: jest.Mock;
};

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
      aiAgentId: 5,
      aiAgentPaused: false,
      aiAgentHandoffRequested: false,
      isGroup: false
    },
    contact: { id: 20, name: "Test" },
    currentMessage: { body: "olá", fromMe: false, hasText: true },
    conversationHistory: [],
    aiAgent: { id: 5, name: "Agent", enabled: true },
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

beforeEach(() => {
  jest.clearAllMocks();
  clearActionRegistry();
  resetBuiltinActionsRegistration();
  mockedEvent.create.mockResolvedValue({ id: 1 });
});

describe("classifyIntent", () => {
  it("prioriza flow sobre chatbot e live", () => {
    const ctx = baseCtx({
      flowState: { active: true, reason: "flow_webhook_active" },
      chatbotState: { active: true },
      metadata: { runtimeMode: "live" },
      aiAgent: { id: 5, enabled: true }
    });
    expect(classifyIntent(ctx)).toEqual({
      intent: "flow",
      reason: "flow_webhook_active"
    });
  });

  it("prioriza chatbot sobre live", () => {
    const ctx = baseCtx({
      chatbotState: { active: true },
      metadata: { runtimeMode: "live" },
      aiAgent: { id: 5, enabled: true }
    });
    expect(classifyIntent(ctx).intent).toBe("chatbot");
  });

  it("retorna live_agent quando runtime live/shadow", () => {
    const ctx = baseCtx({
      metadata: { runtimeMode: "shadow" },
      aiAgent: { id: 5, enabled: true }
    });
    expect(classifyIntent(ctx).intent).toBe("live_agent");
  });

  it("retorna human quando userId presente", () => {
    const ctx = baseCtx({
      ticket: {
        ...baseCtx().ticket,
        userId: 99
      }
    });
    expect(classifyIntent(ctx).intent).toBe("human");
  });
});

describe("planAutomation", () => {
  it("monta steps de flow", () => {
    const plan = planAutomation(
      baseCtx({ flowState: { active: true, reason: "flow_webhook_active" } })
    );
    expect(plan.intent).toBe("flow");
    expect(plan.steps.map(s => s.actionName)).toEqual([
      "ClassifyIntent",
      "LogExecution",
      "FlowAction",
      "FinishExecution"
    ]);
  });

  it("monta steps de knowledge", () => {
    const plan = planAutomation(
      baseCtx({
        aiAgent: { id: 5, enabled: true },
        metadata: { runtimeMode: "dry_run" }
      })
    );
    expect(plan.intent).toBe("knowledge");
    expect(plan.steps.map(s => s.actionName)).toEqual([
      "ClassifyIntent",
      "LogExecution",
      "KnowledgeRetrievalAction",
      "GenerateAIResponseAction",
      "FinishExecution"
    ]);
  });
});

describe("ActionRegistry", () => {
  it("registra todas as actions builtin", () => {
    registerBuiltinActions();
    const names = listActions().sort();
    expect(names).toEqual(
      [
        "ClassifyIntent",
        "LogExecution",
        "KnowledgeRetrievalAction",
        "GenerateAIResponseAction",
        "HumanHandoffAction",
        "ChatbotAction",
        "FlowAction",
        "FinishExecution",
        "WaitForMessageAction"
      ].sort()
    );
    expect(getAction("ClassifyIntent")).toBeDefined();
  });
});

describe("sanitizeAutomationPayload", () => {
  it("remove apiKey e trunca strings", () => {
    const out = sanitizeAutomationPayload({
      apiKey: "sk-secret",
      embeddings: [0.1, 0.2],
      storagePath: "/var/data",
      message: "x".repeat(250),
      ok: true
    });
    expect(out.apiKey).toBeUndefined();
    expect(out.embeddings).toBeUndefined();
    expect(out.storagePath).toBeUndefined();
    expect(out.message).toHaveLength(200);
    expect(out.ok).toBe(true);
  });
});

describe("runAutomationExecution observe", () => {
  it("executa ClassifyIntent com sucesso", async () => {
    registerBuiltinActions();

    const ctx = baseCtx({
      flowState: { active: true, reason: "flow_webhook_active" }
    });
    const plan = planAutomation(ctx);

    const stepUpdates: Array<Record<string, unknown>> = [];
    const stepRow = {
      id: 100,
      stepIndex: 0,
      actionName: "ClassifyIntent",
      status: "pending",
      resultStatus: null as string | null,
      update: jest.fn(async (data: Record<string, unknown>) => {
        Object.assign(stepRow, data);
        stepUpdates.push(data);
        return stepRow;
      })
    };

    const executionRow: Record<string, unknown> = {
      id: 50,
      companyId: 1,
      status: "queued",
      controlMode: "observe",
      currentStep: null,
      intent: plan.intent,
      plan,
      executionContext: ctx,
      startedAt: null,
      update: jest.fn(async (data: Record<string, unknown>) => {
        Object.assign(executionRow, data);
        return executionRow;
      }),
      reload: jest.fn(async () => executionRow)
    };

    mockedExecution.findOne.mockResolvedValue(executionRow);
    mockedStep.findOne.mockResolvedValue(null);
    mockedStep.create.mockImplementation(async (data: Record<string, unknown>) => {
      const row = {
        ...stepRow,
        ...data,
        id: 100 + Number(data.stepIndex || 0),
        update: jest.fn(async (patch: Record<string, unknown>) => {
          Object.assign(row, patch);
          stepUpdates.push(patch);
          return row;
        })
      };
      return row;
    });

    const result = await runAutomationExecution(50, 1);

    expect(result).toBeTruthy();
    expect(mockedStep.create).toHaveBeenCalled();
    const classifyCall = stepUpdates.find(
      u => u.resultStatus === "success" && u.status === "completed"
    );
    expect(classifyCall).toBeTruthy();
    expect(executionRow.status).toBe("completed");
  });
});

describe("StartAutomationExecutionService idempotency", () => {
  it("retorna a mesma execução para o mesmo messageId", async () => {
    const existing = { id: 7, companyId: 1, messageId: "idem-1" };
    mockedExecution.findOne.mockResolvedValue(existing);

    const first = await StartAutomationExecutionService({
      companyId: 1,
      channel: "whatsapp",
      messageId: "idem-1",
      executionContext: baseCtx({ messageId: "idem-1" }),
      runEngine: false
    });

    const second = await StartAutomationExecutionService({
      companyId: 1,
      channel: "whatsapp",
      messageId: "idem-1",
      executionContext: baseCtx({ messageId: "idem-1" }),
      runEngine: false
    });

    expect(first).toBe(existing);
    expect(second).toBe(existing);
    expect(mockedExecution.create).not.toHaveBeenCalled();
  });
});

describe("GetAutomationExecutionService tenant", () => {
  it("lança AppError quando companyId não confere", async () => {
    mockedExecution.findOne.mockResolvedValue(null);

    await expect(
      GetAutomationExecutionService({ companyId: 2, executionId: 99 })
    ).rejects.toBeInstanceOf(AppError);

    expect(mockedExecution.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 99, companyId: 2 }
      })
    );
  });
});

describe("ActionRegistry plugin", () => {
  it("permite registrar action custom", () => {
    registerAction(
      defineAction(
        {
          id: "CustomAction",
          name: "CustomAction",
          category: "future",
          capabilities: ["planner"],
          experimental: true
        },
        {
          execute: async () => ({ status: "success", nextHint: "continue" })
        }
      )
    );
    expect(listActions()).toContain("CustomAction");
  });
});
