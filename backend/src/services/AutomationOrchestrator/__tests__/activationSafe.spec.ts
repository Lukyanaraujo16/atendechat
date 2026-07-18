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
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/AutomationOrchestratorSettings", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/AutomationPlannerValidation", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn()
  }
}));

import AppError from "../../../errors/AppError";
import AutomationExecution from "../../../models/AutomationExecution";
import AutomationOrchestratorSettings from "../../../models/AutomationOrchestratorSettings";
import {
  AUTOMATION_CIRCUIT_BREAKER,
  AUTOMATION_DEFAULT_CONTROL_MODE
} from "../../../config/automationOrchestratorConstants";
import {
  canExecuteAction,
  getDefaultCapabilities,
  mergeCapabilities,
  validateCapabilityConsistency
} from "../activation/capabilityPolicy";
import { resolveOwnership } from "../activation/resolveOwnership";
import {
  __resetCircuitBreakerForTests,
  isCircuitOpen,
  recordFailure,
  tripCircuit
} from "../activation/circuitBreaker";
import { comparePlannerVsLegacy } from "../activation/divergenceEngine";
import { StartAutomationExecutionService } from "../StartAutomationExecutionService";
import {
  clearActionRegistry,
  getAction
} from "../ActionRegistry";
import {
  registerBuiltinActions,
  resetBuiltinActionsRegistration
} from "../registerBuiltinActions";
import { ExecutionContext } from "../types";

const mockedSettings = AutomationOrchestratorSettings as unknown as {
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

const mockedExecution = AutomationExecution as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

function baseCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    companyId: 1,
    ticketId: 10,
    contactId: 20,
    whatsappId: 30,
    channel: "whatsapp",
    messageId: "msg-act-1",
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
  __resetCircuitBreakerForTests();
  mockedSettings.findAll.mockResolvedValue([]);
  mockedSettings.findOne.mockResolvedValue(null);
  mockedExecution.findOne.mockResolvedValue(null);
});

describe("resolveOwnership", () => {
  it("default ownership is legacy for observe/shadow", () => {
    expect(
      resolveOwnership({
        controlMode: "observe",
        circuitOpen: false,
        settingsEnabled: true
      }).ownership
    ).toBe("legacy");

    expect(
      resolveOwnership({
        controlMode: "shadow_execute",
        circuitOpen: false,
        settingsEnabled: true
      }).ownership
    ).toBe("legacy");
  });

  it("orchestrator only when active and circuit closed", () => {
    expect(
      resolveOwnership({
        controlMode: "active",
        circuitOpen: false,
        settingsEnabled: true
      }).ownership
    ).toBe("orchestrator");

    expect(
      resolveOwnership({
        controlMode: "active",
        circuitOpen: true,
        settingsEnabled: true
      }).ownership
    ).toBe("legacy");
  });
});

describe("capabilityPolicy", () => {
  it("observe never treats side-effect actions as active mutators", () => {
    registerBuiltinActions();
    const chatbot = getAction("ChatbotAction");
    expect(chatbot?.sideEffects).toBe(true);

    const gate = canExecuteAction({
      controlMode: "observe",
      capabilities: getDefaultCapabilities(),
      actionName: "ChatbotAction",
      actionMeta: chatbot
    });
    expect(gate.allowed).toBe(true);
    expect(gate.effectiveMode).toBe("observe");
  });

  it("shadow_execute skips sideEffect actions", () => {
    registerBuiltinActions();
    const flow = getAction("FlowAction");
    const gate = canExecuteAction({
      controlMode: "shadow_execute",
      capabilities: getDefaultCapabilities(),
      actionName: "FlowAction",
      actionMeta: flow
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("shadow_skips_side_effects");
  });

  it("validateCapabilityConsistency blocks send_message=active with planner=observe", () => {
    const caps = mergeCapabilities({
      send_message: "active",
      planner: "observe"
    });
    expect(() =>
      validateCapabilityConsistency("observe", caps)
    ).toThrow(AppError);
  });
});

describe("divergenceEngine", () => {
  it("marks IA vs chatbot as critical", () => {
    const result = comparePlannerVsLegacy("live_agent", "chatbot");
    expect(result.matched).toBe(false);
    expect(result.severity).toBe("critical");
  });

  it("matches identical intents", () => {
    expect(comparePlannerVsLegacy("flow", "flow")).toEqual({
      matched: true,
      severity: "match",
      reason: "intents_match"
    });
  });
});

describe("circuitBreaker", () => {
  it("trips after maxFailures", () => {
    const companyId = 42;
    expect(isCircuitOpen(companyId)).toBe(false);

    for (let i = 0; i < AUTOMATION_CIRCUIT_BREAKER.maxFailures; i += 1) {
      recordFailure(companyId, "failure");
    }

    expect(isCircuitOpen(companyId)).toBe(true);
  });

  it("tripCircuit opens immediately", () => {
    tripCircuit(99, "manual");
    expect(isCircuitOpen(99)).toBe(true);
  });
});

describe("disabled mode skips start", () => {
  it("returns null when controlMode disabled", async () => {
    mockedSettings.findAll.mockResolvedValue([
      {
        id: 1,
        companyId: 1,
        whatsappId: null,
        aiAgentId: null,
        controlMode: "disabled",
        capabilities: null,
        enabled: true,
        circuitBreakerOpenUntil: null,
        metadata: null
      }
    ]);

    const result = await StartAutomationExecutionService({
      companyId: 1,
      messageId: "disabled-1",
      executionContext: baseCtx({ controlMode: "disabled" }),
      controlMode: "disabled",
      runEngine: false
    });

    expect(result).toBeNull();
    expect(mockedExecution.create).not.toHaveBeenCalled();
  });
});

describe("tenant settings scoped by companyId", () => {
  it("ResolveOrchestratorSettingsService filters by companyId", async () => {
    const { ResolveOrchestratorSettingsService } = await import(
      "../activation/ResolveOrchestratorSettingsService"
    );

    mockedSettings.findAll.mockImplementation(async (opts: { where: { companyId: number } }) => {
      expect(opts.where.companyId).toBe(7);
      return [
        {
          id: 10,
          companyId: 7,
          whatsappId: null,
          aiAgentId: null,
          controlMode: "observe",
          capabilities: { planner: "observe" },
          enabled: true,
          circuitBreakerOpenUntil: null,
          metadata: null
        }
      ];
    });

    const settings = await ResolveOrchestratorSettingsService({
      companyId: 7,
      whatsappId: null,
      aiAgentId: null
    });

    expect(settings.companyId).toBe(7);
    expect(settings.controlMode).toBe("observe");
    expect(mockedSettings.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 7 } })
    );
  });
});
