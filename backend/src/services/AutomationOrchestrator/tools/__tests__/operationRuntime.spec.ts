/**
 * Fase 2.1C — Operation Runtime + Write Tools
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
import { buildToolExecutionContext } from "../ToolExecutionContext";
import { runToolViaRuntime } from "../AutomationToolRuntime";
import { evaluateToolPolicy } from "../AutomationToolPolicyEngine";
import { runOperationViaRuntime } from "../operations/AutomationOperationRuntime";
import {
  ContactUpdateAllowedFieldsOperation,
  TicketTransferOperation
} from "../operations/domainOperations";
import { toOperationModelResult } from "../operations/OperationModelResultAdapter";
import { WRITE_TOOLS } from "../tools/WriteBusinessTools";
import { __resetToolCircuitBreakerForTests } from "../ToolCircuitBreaker";
import { __resetToolRateLimitForTests } from "../ToolRateLimit";
import { __resetToolMetricsForTests } from "../ToolMetrics";
import { __resetToolEventsForTests, getRecentToolEvents } from "../ToolEventBus";

jest.mock("../../../../libs/cache", () => ({
  setNx: jest.fn(async () => true),
  del: jest.fn(async () => undefined),
  get: jest.fn(async () => null),
  set: jest.fn(async () => undefined)
}));

jest.mock("../../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async () => ({
      commit: jest.fn(async () => undefined),
      rollback: jest.fn(async () => undefined)
    }))
  }
}));

jest.mock("../../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async ({ where }: { where: { id: number; companyId: number } }) => {
      if (where.companyId !== 1 || where.id !== 1) return null;
      return {
        id: 1,
        name: "Ana",
        email: "ana@example.com",
        notes: "antiga"
      };
    })
  }
}));

jest.mock("../../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.companyId !== 1) return null;
      if (where.id === 10 || where.contactId === 1) {
        return {
          id: 10,
          status: "open",
          queueId: 2,
          userId: 3,
          contactId: 1,
          updatedAt: new Date(),
          queue: { id: 2, name: "Suporte" },
          user: { id: 3, name: "Atendente" }
        };
      }
      return null;
    }),
    findAll: jest.fn(async () => [{ id: 10 }])
  }
}));

jest.mock("../../../../models/Tag", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async ({ where }: { where: { id: number; companyId: number } }) => {
      if (where.companyId !== 1 || where.id !== 9) return null;
      return { id: 9, name: "vip", color: "#f00" };
    })
  }
}));

jest.mock("../../../../models/Queue", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async ({ where }: { where: { id: number; companyId: number } }) => {
      if (where.companyId !== 1) return null;
      if (where.id === 5) return { id: 5, name: "Comercial" };
      if (where.id === 2) return { id: 2, name: "Suporte" };
      return null;
    })
  }
}));

jest.mock("../../../../models/User", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async ({ where }: { where: { id: number; companyId: number } }) => {
      if (where.companyId !== 1 || where.id !== 7) return null;
      return { id: 7, name: "Novo Atendente" };
    })
  }
}));

jest.mock("../../../../models/TicketTag", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => null),
    count: jest.fn(async () => 0)
  }
}));

jest.mock("../../../../models/TicketNote", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async () => null),
    count: jest.fn(async () => 0)
  }
}));

const updateContactMock = jest.fn(async (_args?: unknown) => ({
  id: 1,
  name: "Ana Atualizada",
  email: "nova@example.com",
  notes: "nova"
}));
jest.mock("../../../ContactServices/UpdateContactService", () => ({
  __esModule: true,
  default: (args: unknown) => updateContactMock(args)
}));

jest.mock("../../../ContactServices/AddTagToContactService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({ ticketId: 10, tagId: 9 }))
}));

jest.mock("../../../ContactServices/RemoveTagFromContactService", () => ({
  __esModule: true,
  default: jest.fn(async () => undefined)
}));

const updateTicketMock = jest.fn(async (_args?: unknown) => ({
  ticket: {
    id: 10,
    status: "pending",
    queueId: 5,
    userId: 7
  },
  oldStatus: "open",
  oldUserId: 3
}));
jest.mock("../../../TicketServices/UpdateTicketService", () => ({
  __esModule: true,
  default: (args: unknown) => updateTicketMock(args)
}));

jest.mock("../../../TicketNoteService/CreateTicketNoteService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({ id: 99, note: "nota", ticketId: 10 }))
}));

function writeCtx(
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
      "tool.write": true,
      "contact.write": true,
      "ticket.write": true,
      "tag.write": true,
      "note.write": true
    },
    permissions: [
      "aiTools.view",
      "aiTools.test",
      "aiTools.executeRead",
      "aiTools.executeWrite"
    ],
    featureFlags: {
      [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
      [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true
    },
    requestId: "req-w1",
    correlationId: "corr-w1",
    metadata: { writeMode: "dry_run", operationRuntime: true },
    ...overrides
  });
}

const writePolicy = {
  enabled: true,
  maxRiskLevel: "medium" as const,
  allowWrite: true,
  requireConfirmationFor: [] as never[],
  deniedToolIds: [] as string[],
  allowedToolIds: null as string[] | null
};

describe("Automation Operation Runtime 2.1C", () => {
  beforeEach(() => {
    resetBuiltinToolsRegistration();
    clearToolRegistry();
    __resetToolCircuitBreakerForTests();
    __resetToolRateLimitForTests();
    __resetToolMetricsForTests();
    __resetToolEventsForTests();
    registerBuiltinTools();
    updateContactMock.mockClear();
    updateTicketMock.mockClear();
  });

  it("registra exatamente as 5 Write Tools via Operation Runtime", () => {
    const ids = WRITE_TOOLS.map(t => t.manifest().id).sort();
    expect(ids).toEqual([
      "add.contact.tag",
      "contact.update_allowed_fields",
      "internal.note.create",
      "remove.contact.tag",
      "ticket.transfer"
    ]);
    for (const t of WRITE_TOOLS) {
      expect(t.manifest().metadata.operationRuntime).toBe(true);
      expect(t.manifest().sideEffectType).toBe("database_write");
      expect(t.manifest().requiredPermissions).toContain("aiTools.executeWrite");
      expect(getTool(t.manifest().id)).toBeTruthy();
    }
  });

  it("Operation Preview sem alteração", async () => {
    const op = await runOperationViaRuntime({
      operation: ContactUpdateAllowedFieldsOperation,
      toolCtx: writeCtx(),
      input: { contactId: 1, name: "Ana Atualizada" },
      previewOnly: true
    });
    expect(op.status).toBe("preview");
    expect(op.preview?.summary).toMatch(/update_contact/);
    expect(op.preview?.proposed.name).toBe("Ana Atualizada");
    expect(updateContactMock).not.toHaveBeenCalled();
    expect(
      getRecentToolEvents(1).some(e => e.eventName === "OperationPreviewGenerated")
    ).toBe(true);
  });

  it("Dry Run captura before/after sem persistir", async () => {
    const op = await runOperationViaRuntime({
      operation: ContactUpdateAllowedFieldsOperation,
      toolCtx: writeCtx(),
      input: { contactId: 1, email: "nova@example.com" },
      dryRun: true
    });
    expect(op.status).toBe("dry_run");
    expect(op.before.length).toBeGreaterThan(0);
    expect(op.after.length).toBeGreaterThan(0);
    expect(op.metrics.dryRun).toBe(true);
    expect(updateContactMock).not.toHaveBeenCalled();
    expect(
      getRecentToolEvents(1).some(e => e.eventName === "OperationDryRunExecuted")
    ).toBe(true);
  });

  it("Execute real via Operation Runtime", async () => {
    const op = await runOperationViaRuntime({
      operation: ContactUpdateAllowedFieldsOperation,
      toolCtx: writeCtx({
        metadata: { writeMode: "execute", operationRuntime: true }
      }),
      input: { contactId: 1, name: "Ana Atualizada", email: "nova@example.com" },
      dryRun: false,
      confirmed: true
    });
    expect(op.status).toBe("success");
    expect(updateContactMock).toHaveBeenCalled();
    expect(op.changedFields.length).toBeGreaterThan(0);
    expect(op.transaction?.committed).toBe(true);
    expect(
      getRecentToolEvents(1).some(e => e.eventName === "OperationCompleted")
    ).toBe(true);
  });

  it("OperationModelResult não expõe audit/transaction", () => {
    const model = toOperationModelResult({
      status: "success",
      operationId: "contact.update_allowed_fields",
      operationVersion: "1.0.0",
      preview: {
        operationId: "contact.update_allowed_fields",
        summary: "ok",
        current: {},
        proposed: {},
        validations: [],
        warnings: [],
        affectedResources: [],
        blockers: [],
        dryRunCapable: true
      },
      before: [{ resourceType: "contact", resourceId: 1, fields: { name: "A" }, capturedAt: "" }],
      after: [{ resourceType: "contact", resourceId: 1, fields: { name: "B" }, capturedAt: "" }],
      changedFields: [{ field: "contact:1.name", before: "A", after: "B" }],
      data: { secret: true },
      warnings: [],
      errors: [],
      metrics: {
        durationMs: 1,
        dryRun: false,
        previewOnly: false,
        lockAcquired: true,
        transactionUsed: true
      },
      transaction: { id: "tx", opened: true, committed: true, rolledBack: false },
      rollback: { requested: false, supported: false, succeeded: false },
      audit: {
        operationId: "contact.update_allowed_fields",
        operationVersion: "1.0.0",
        companyId: 1,
        source: "admin_test",
        dryRun: false,
        previewOnly: false,
        confirmed: true,
        transactionId: "tx",
        durationMs: 1,
        status: "success"
      }
    });
    expect(model.summary).toBe("ok");
    expect(model.changes?.[0].field).toBe("contact:1.name");
    expect(JSON.stringify(model)).not.toMatch(/transactionId|audit|secret/);
  });

  it("ticket.transfer exige confirmação (waiting_confirmation)", async () => {
    const op = await runOperationViaRuntime({
      operation: TicketTransferOperation,
      toolCtx: writeCtx({
        metadata: { writeMode: "execute", operationRuntime: true }
      }),
      input: { ticketId: 10, queueId: 5 },
      dryRun: false,
      confirmed: false
    });
    expect(op.status).toBe("waiting_confirmation");
    expect(updateTicketMock).not.toHaveBeenCalled();
  });

  it("Write Tool via Tool Runtime (dry_run)", async () => {
    const result = await runToolViaRuntime({
      toolId: "contact.update_allowed_fields",
      ctx: writeCtx({
        metadata: { writeMode: "dry_run", operationRuntime: true }
      }),
      input: {
        contactId: 1,
        name: "X",
        dryRun: true,
        execute: false
      },
      companyPolicy: { ...writePolicy, allowWrite: false },
      persist: false
    });
    expect(result.status).toBe("success");
    expect(result.data.operationStatus).toBe("dry_run");
    expect(result.data.before).toBeTruthy();
    expect(result.data.after).toBeTruthy();
    expect(updateContactMock).not.toHaveBeenCalled();
  });

  it("Policy: escrita sem writeMode no admin_test é deny", () => {
    const m = getTool("contact.update_allowed_fields")!.manifest();
    const decision = evaluateToolPolicy({
      manifest: m,
      ctx: writeCtx({ metadata: {} }),
      companyPolicy: writePolicy
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("admin_test_write_mode_required");
  });

  it("Policy: execute sem allowWrite é deny", () => {
    const m = getTool("contact.update_allowed_fields")!.manifest();
    const decision = evaluateToolPolicy({
      manifest: m,
      ctx: writeCtx({
        metadata: { writeMode: "execute", operationRuntime: true }
      }),
      companyPolicy: { ...writePolicy, allowWrite: false }
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/allow_write|write_not_explicitly/);
  });

  it("Policy: permissão aiTools.executeWrite obrigatória", () => {
    const m = getTool("add.contact.tag")!.manifest();
    const decision = evaluateToolPolicy({
      manifest: m,
      ctx: writeCtx({
        permissions: ["aiTools.view", "aiTools.test", "aiTools.executeRead"],
        metadata: { writeMode: "dry_run", operationRuntime: true }
      }),
      companyPolicy: { ...writePolicy, allowWrite: false }
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("permission_denied");
  });

  it("campo não permitido bloqueia update", async () => {
    const op = await runOperationViaRuntime({
      operation: ContactUpdateAllowedFieldsOperation,
      toolCtx: writeCtx(),
      input: {
        contactId: 1,
        fields: { name: "ok", companyId: 99 }
      },
      dryRun: true
    });
    expect(op.status).toBe("failure");
    expect(op.errors[0]?.type).toBe("validation");
  });

  it("nenhuma Write Tool bypassa Operation Runtime (contrato)", () => {
    const writes = listTools({ includeExperimental: true }).filter(
      t => t.sideEffectType === "database_write"
    );
    expect(writes.length).toBe(5);
    for (const t of writes) {
      expect(t.metadata.operationRuntime).toBe(true);
      expect(t.exposeToModel).toBe(false);
    }
  });
});
