/**
 * AI Agent V2.5 — Execution Feedback Engine tests
 */
import {
  FEEDBACK_STEP_STATUSES,
  FEEDBACK_RECOVERY_DECISIONS,
  FEEDBACK_NEXT_DECISIONS,
  FEEDBACK_EVENTS
} from "../../../../../config/automationExecutionFeedbackConstants";
import { ExecutionFeedbackEngine } from "../ExecutionFeedbackEngine";
import {
  applyFeedbackRules,
  computeGoalProgress,
  computeConfidence
} from "../FeedbackRules";
import {
  extractFeedbackKnowledge,
  mapRuntimeStatusToStepStatus
} from "../KnowledgeExtraction";
import {
  __resetExecutionFeedbackConfigForTests,
  getExecutionFeedbackConfig,
  setExecutionFeedbackConfig
} from "../ExecutionFeedbackConfig";
import { __resetExecutionFeedbackMetricsForTests } from "../ExecutionFeedbackMetrics";
import {
  __resetExecutionFeedbackAdminForTests,
  GetExecutionFeedbackDashboardService,
  ProcessExecutionFeedbackService,
  SimulateFeedbackService
} from "../ExecutionFeedbackAdminServices";
import * as RuntimeAdmin from "../../../runtimeIntegration/RuntimeIntegrationAdminServices";
import { ExecutionSession } from "../../execution/executionTypes";

function baseSession(overrides: Partial<ExecutionSession> = {}): ExecutionSession {
  return {
    id: "sess_1",
    companyId: 1,
    goalId: "g1",
    planId: "p1",
    evaluationId: null,
    status: "RUNNING",
    currentStepId: "s1",
    completedSteps: [],
    failedSteps: [],
    skippedSteps: [],
    pendingSteps: ["s1", "s2"],
    waitingSteps: [],
    executionContext: {},
    validationState: {},
    recoveryState: {
      active: false,
      lastAction: null,
      attempts: 0,
      history: []
    },
    graph: {
      planId: "p1",
      nodes: [
        {
          nodeId: "n1",
          stepId: "s1",
          type: "search",
          objective: "buscar",
          dependencies: [],
          children: [],
          parents: [],
          parallelGroup: 0,
          checkpoint: false,
          optional: false,
          retryable: true,
          requiresConfirmation: false
        },
        {
          nodeId: "n2",
          stepId: "s2",
          type: "custom",
          objective: "fim",
          dependencies: ["s1"],
          children: [],
          parents: ["n1"],
          parallelGroup: 0,
          checkpoint: false,
          optional: false,
          retryable: true,
          requiresConfirmation: false
        }
      ],
      order: ["s1", "s2"],
      parallelGroups: [],
      edges: [],
      entryNodeIds: ["s1"],
      exitNodeIds: ["s2"]
    },
    checkpoints: [],
    events: [],
    timestamps: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    metrics: {
      stepsTotal: 2,
      stepsCompleted: 0,
      stepsFailed: 0,
      stepsSkipped: 0,
      retries: 0,
      pauses: 0,
      waitingCount: 0,
      recoveries: 0,
      durationMs: 0
    },
    metadata: {},
    version: "2.5.0",
    ...overrides
  };
}

describe("Execution Feedback Engine V2.5", () => {
  beforeEach(() => {
    __resetExecutionFeedbackConfigForTests();
    __resetExecutionFeedbackMetricsForTests();
    __resetExecutionFeedbackAdminForTests();
    jest.restoreAllMocks();
  });

  it("statuses, recovery, next decision e eventos definidos", () => {
    expect(FEEDBACK_STEP_STATUSES).toContain("PARTIAL");
    expect(FEEDBACK_RECOVERY_DECISIONS).toContain("ASK_INPUT");
    expect(FEEDBACK_NEXT_DECISIONS).toContain("FINISH");
    expect(FEEDBACK_EVENTS).toContain("REPLAN_REQUESTED");
  });

  it("mapRuntimeStatusToStepStatus cobre casos principais", () => {
    expect(mapRuntimeStatusToStepStatus({ runtimeStatus: "success" })).toBe(
      "SUCCESS"
    );
    expect(mapRuntimeStatusToStepStatus({ runtimeStatus: "waiting" })).toBe(
      "WAITING"
    );
    expect(mapRuntimeStatusToStepStatus({ runtimeStatus: "denied" })).toBe(
      "PARTIAL"
    );
    expect(mapRuntimeStatusToStepStatus({ runtimeStatus: "failure" })).toBe(
      "FAILED"
    );
  });

  it("Knowledge Extraction estrutura entidades/warnings/errors", () => {
    const knowledge = extractFeedbackKnowledge({
      runtimeResult: {
        warnings: ["w1"],
        errors: [],
        toolId: "knowledge.search",
        modelResult: { data: { query: "produto", hits: 1 } }
      },
      entities: [{ key: "domain", value: "knowledge" }],
      constraints: ["require:contactId"]
    });
    expect(knowledge.entitiesFound.some(e => e.key === "query")).toBe(true);
    expect(knowledge.entitiesMissing).toContain("contactId");
    expect(knowledge.warnings).toContain("w1");
    expect(knowledge.changesMade.some(c => c.includes("knowledge.search"))).toBe(
      true
    );
  });

  it("Goal Progress calcula percentual e goalAchieved", () => {
    const progress = computeGoalProgress({
      companyId: 1,
      stepsTotal: 4,
      completedSteps: 2,
      failedSteps: 0,
      pendingSteps: 2,
      skippedSteps: 0
    });
    expect(progress.completionPercentage).toBe(50);
    expect(progress.goalAchieved).toBe(false);

    const done = computeGoalProgress({
      companyId: 1,
      stepsTotal: 2,
      completedSteps: 2,
      failedSteps: 0,
      pendingSteps: 0
    });
    expect(done.goalAchieved).toBe(true);
  });

  it("Recovery Decision: failure retryable → RETRY", () => {
    const rules = applyFeedbackRules({
      companyId: 1,
      stepStatus: "FAILED",
      stepRetryable: true,
      recoveryAttempts: 0,
      goalProgress: {
        completedSteps: 0,
        pendingSteps: 1,
        failedSteps: 1,
        completionPercentage: 0,
        goalAchieved: false
      }
    });
    expect(rules.recoveryDecision).toBe("RETRY");
    expect(rules.nextDecision).toBe("CONTINUE");
  });

  it("Next Decision: waiting → WAIT + human intervention", () => {
    const rules = applyFeedbackRules({
      companyId: 1,
      stepStatus: "WAITING",
      requiresConfirmation: true,
      goalProgress: {
        completedSteps: 0,
        pendingSteps: 1,
        failedSteps: 0,
        completionPercentage: 0,
        goalAchieved: false
      }
    });
    expect(rules.nextDecision).toBe("WAIT");
    expect(rules.humanInterventionRequired).toBe(true);
    expect(rules.recoveryDecision).toBe("ASK_CONFIRMATION");
  });

  it("Session Update Engine aplica feedback na sessão", () => {
    const session = baseSession();
    const engine = new ExecutionFeedbackEngine();
    const record = engine.process({
      companyId: 1,
      session,
      actionId: "a1",
      stepId: "s1",
      runtimeResult: { status: "success", errors: [], warnings: [] },
      actionResult: { status: "SUCCESS", validation: "VALID" }
    });
    const updated = (record as any).updatedSession as ExecutionSession;
    expect(updated.completedSteps).toContain("s1");
    expect(record.sessionUpdate.nextStatus).toBe("RUNNING");
    expect(record.feedback.metadata.executesTools).toBe(false);
    expect(record.feedback.metadata.callsPlanner).toBe(false);
  });

  it("Feedback Engine gera confidence e eventos", () => {
    const record = new ExecutionFeedbackEngine().process({
      companyId: 2,
      session: baseSession({ companyId: 2 }),
      runtimeResult: { status: "success", errors: [], warnings: ["soft"] },
      actionResult: { status: "SUCCESS", validation: "VALID" }
    });
    expect(record.feedback.confidence).toBeGreaterThan(0.5);
    expect(record.events.some(e => e.name === "FEEDBACK_CREATED")).toBe(true);
    expect(record.events.some(e => e.name === "SESSION_UPDATED")).toBe(true);
    expect(record.events.some(e => e.name === "GOAL_PROGRESS_UPDATED")).toBe(
      true
    );
  });

  it("failure non-recoverable → ABORT / STOP", () => {
    const session = baseSession();
    session.graph.nodes[0].retryable = false;
    session.graph.nodes[0].optional = false;
    const record = new ExecutionFeedbackEngine().process({
      companyId: 1,
      session,
      stepId: "s1",
      stepRetryable: false,
      stepOptional: false,
      runtimeResult: { status: "failure", errors: ["boom"], warnings: [] }
    });
    expect(record.feedback.recoveryDecision).toBe("ABORT");
    expect(record.feedback.nextDecision).toBe("STOP");
  });

  it("config administrativa sem hardcode", () => {
    setExecutionFeedbackConfig(3, {
      thresholds: { goalAchievedPercentage: 80 }
    } as any);
    const cfg = getExecutionFeedbackConfig(3);
    expect(cfg.thresholds.goalAchievedPercentage).toBe(80);
    expect(cfg.executesTools).toBe(false);
  });

  it("SimulateFeedbackService e dashboard", async () => {
    await SimulateFeedbackService({
      companyId: 4,
      runtimeStatus: "success",
      objective: "produto"
    });
    const dash = await GetExecutionFeedbackDashboardService({ companyId: 4 });
    expect(dash.executesTools).toBe(false);
    expect(dash.callsPlanner).toBe(false);
    expect(dash.metrics.feedbacksGenerated).toBeGreaterThanOrEqual(1);
  });

  it("ProcessExecutionFeedbackService com runtime denial → replan path", async () => {
    const { record } = await ProcessExecutionFeedbackService({
      companyId: 5,
      runtimeResult: { status: "denied", errors: ["tool_not_in_allowlist"] },
      actionResult: { status: "FAILED", validation: "PARTIAL" }
    });
    expect(record.feedback.stepStatus).toBe("PARTIAL");
    expect(["REPLAN", "CONTINUE"]).toContain(record.feedback.nextDecision);
  });

  it("replay expande Runtime → Feedback → Session Update", async () => {
    jest.spyOn(RuntimeAdmin, "ReplayRuntimeIntegrationService").mockResolvedValue({
      replay: {
        cognitive: {
          session: baseSession({ id: "sess_replay" }),
          goal: { id: "g" },
          plan: { id: "p" }
        },
        runtimeSlices: [
          {
            action: {
              id: "act1",
              stepId: "s1",
              actionType: "SEARCH",
              objective: "x",
              entities: [],
              constraints: [],
              expectedOutcome: "",
              requiresConfirmation: false,
              retryable: true,
              metadata: {}
            },
            request: {
              requestId: "rreq1",
              actionId: "act1",
              executionId: "e1",
              runtimeType: "TOOL_RUNTIME",
              operation: "search",
              entities: [],
              parameters: {},
              constraints: [],
              timeout: 1000,
              retryPolicy: { maxAttempts: 1, backoffMs: 0 },
              confirmationPolicy: { required: false, confirmed: false },
              metadata: {}
            },
            capability: {
              kind: "SEARCH_KNOWLEDGE",
              runtimeType: "TOOL_RUNTIME",
              requiredAdapter: "ToolRuntimeAdapter",
              metadata: {}
            },
            policy: {
              approved: true,
              warnings: [],
              violations: [],
              costEstimate: 0,
              timeout: 1000,
              retry: { maxAttempts: 1, backoffMs: 0 },
              metadata: {}
            },
            adapterResult: {
              status: "success",
              runtimeType: "TOOL_RUNTIME",
              adapter: "ToolRuntimeAdapter",
              capability: "SEARCH_KNOWLEDGE",
              errors: [],
              warnings: [],
              durationMs: 1,
              metadata: { reusedExistingRuntime: true }
            },
            actionResult: {
              actionId: "act1",
              stepId: "s1",
              actionType: "SEARCH",
              strategy: "Runtime:ToolRuntimeAdapter",
              status: "SUCCESS",
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              duration: 1,
              output: {},
              validation: "VALID",
              metrics: { retries: 0, simulatedLatencyMs: 0 },
              errors: [],
              warnings: [],
              metadata: {}
            },
            events: []
          }
        ]
      } as any
    });

    const { ReplayExecutionFeedbackService } = await import(
      "../ExecutionFeedbackAdminServices"
    );
    const { replay } = await ReplayExecutionFeedbackService({
      companyId: 6,
      text: "como funciona?"
    });
    expect(replay.feedbackSlices.length).toBe(1);
    expect(replay.feedbackSlices[0].feedback.feedbackId).toBeTruthy();
    expect(replay.feedbackSlices[0].sessionUpdate).toBeTruthy();
    expect(replay.feedbackSlices[0].finalState).toBeTruthy();
  });

  it("computeConfidence aplica penalidades", () => {
    const high = computeConfidence({
      companyId: 1,
      stepStatus: "SUCCESS",
      warningCount: 0,
      errorCount: 0
    });
    const low = computeConfidence({
      companyId: 1,
      stepStatus: "FAILED",
      warningCount: 2,
      errorCount: 1
    });
    expect(high).toBeGreaterThan(low);
  });
});
