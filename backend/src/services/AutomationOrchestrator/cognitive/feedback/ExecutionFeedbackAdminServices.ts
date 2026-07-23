import { createHash } from "crypto";
import { mapStepToExecutionAction } from "../action/ActionExecutionEngine";
import { ReplayRuntimeIntegrationService } from "../../runtimeIntegration/RuntimeIntegrationAdminServices";
import { ExecutionFeedbackEngine } from "./ExecutionFeedbackEngine";
import {
  getExecutionFeedbackConfig,
  setExecutionFeedbackConfig
} from "./ExecutionFeedbackConfig";
import {
  findFeedbackRecord,
  getExecutionFeedbackMetrics,
  listFeedbackRecords
} from "./ExecutionFeedbackMetrics";
import {
  FeedbackProcessRecord,
  FeedbackReplaySlice
} from "./feedbackTypes";
import { ExecutionSession } from "../execution/executionTypes";
import {
  CreateExecutionSessionService,
  __resetExecutionSessionsForTests
} from "../execution/ExecutionOrchestratorAdminServices";
import { startExecutionSession } from "../execution/ExecutionOrchestrator";

const replaysByCompany = new Map<
  number,
  Array<{
    id: string;
    slices: FeedbackReplaySlice[];
    createdAt: string;
  }>
>();

function pushCap<T>(arr: T[], item: T, max = 100): void {
  arr.push(item);
  if (arr.length > max) arr.shift();
}

function buildSyntheticSession(input: {
  companyId: number;
  sessionId?: string;
  stepId?: string;
}): ExecutionSession {
  const stepId = input.stepId || "step_1";
  return {
    id: input.sessionId || `sess_fb_${Date.now()}`,
    companyId: input.companyId,
    goalId: "goal_sim",
    planId: "plan_sim",
    evaluationId: null,
    status: "RUNNING",
    currentStepId: stepId,
    completedSteps: [],
    failedSteps: [],
    skippedSteps: [],
    pendingSteps: [stepId, "step_2"],
    waitingSteps: [],
    executionContext: { executesTools: false },
    validationState: {},
    recoveryState: {
      active: false,
      lastAction: null,
      attempts: 0,
      history: []
    },
    graph: {
      planId: "plan_sim",
      nodes: [
        {
          nodeId: "n1",
          stepId,
          type: "search",
          objective: "buscar",
          dependencies: [],
          children: ["n2"],
          parents: [],
          parallelGroup: 0,
          checkpoint: false,
          optional: false,
          retryable: true,
          requiresConfirmation: false
        },
        {
          nodeId: "n2",
          stepId: "step_2",
          type: "custom",
          objective: "finalizar",
          dependencies: [stepId],
          children: [],
          parents: ["n1"],
          parallelGroup: 0,
          checkpoint: false,
          optional: false,
          retryable: true,
          requiresConfirmation: false
        }
      ],
      order: [stepId, "step_2"],
      parallelGroups: [],
      edges: [{ from: stepId, to: "step_2" }],
      entryNodeIds: [stepId],
      exitNodeIds: ["step_2"]
    },
    checkpoints: [],
    events: [],
    timestamps: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: new Date().toISOString()
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
    metadata: { executesTools: false },
    version: "2.5.0"
  };
}

export async function ProcessExecutionFeedbackService(input: {
  companyId: number;
  session?: ExecutionSession;
  sessionId?: string;
  actionId?: string;
  stepId?: string;
  runtimeRequestId?: string;
  runtimeResultId?: string;
  runtimeResult?: Record<string, unknown>;
  actionResult?: Record<string, unknown>;
  entities?: Array<{ key: string; value: string }>;
  constraints?: string[];
  stepRetryable?: boolean;
  stepOptional?: boolean;
  requiresConfirmation?: boolean;
  text?: string;
}): Promise<{
  record: FeedbackProcessRecord;
  updatedSession: ExecutionSession;
}> {
  let session = input.session;
  if (!session) {
    if (input.sessionId) {
      session = buildSyntheticSession({
        companyId: input.companyId,
        sessionId: input.sessionId,
        stepId: input.stepId
      });
    } else if (input.text) {
      const created = await CreateExecutionSessionService({
        companyId: input.companyId,
        text: input.text
      });
      session = created.session;
      startExecutionSession(session);
    } else {
      session = buildSyntheticSession({
        companyId: input.companyId,
        stepId: input.stepId
      });
    }
  }

  const engine = new ExecutionFeedbackEngine();
  const record = engine.process({
    companyId: input.companyId,
    session,
    actionId: input.actionId,
    stepId: input.stepId,
    runtimeRequestId: input.runtimeRequestId,
    runtimeResultId: input.runtimeResultId,
    runtimeResult: input.runtimeResult,
    actionResult: input.actionResult,
    entities: input.entities,
    constraints: input.constraints,
    stepRetryable: input.stepRetryable,
    stepOptional: input.stepOptional,
    requiresConfirmation: input.requiresConfirmation
  });

  return {
    record,
    updatedSession: (record as any).updatedSession as ExecutionSession
  };
}

export async function ListExecutionFeedbackService(input: {
  companyId: number;
  limit?: number;
}) {
  return {
    feedbacks: listFeedbackRecords(input.limit || 50),
    metrics: getExecutionFeedbackMetrics()
  };
}

export async function GetExecutionFeedbackService(input: {
  companyId: number;
  id: string;
}) {
  return { feedback: findFeedbackRecord(input.id) };
}

export async function GetExecutionFeedbackDashboardService(input: {
  companyId: number;
}) {
  const metrics = getExecutionFeedbackMetrics();
  return {
    goalProgress: metrics.averageProgress,
    recovery: metrics.recoveryRate,
    replans: metrics.replanRate,
    humanIntervention: metrics.humanInterventionRate,
    completion: metrics.goalCompletionRate,
    metrics,
    executesTools: false,
    callsPlanner: false
  };
}

export async function GetExecutionFeedbackConfigService(input: {
  companyId: number;
}) {
  return { config: getExecutionFeedbackConfig(input.companyId) };
}

export async function UpsertExecutionFeedbackConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  return {
    config: setExecutionFeedbackConfig(input.companyId, input.config)
  };
}

export async function SimulateFeedbackService(input: {
  companyId: number;
  runtimeStatus?: string;
  actionStatus?: string;
  validation?: string;
  requiresConfirmation?: boolean;
  stepRetryable?: boolean;
  stepOptional?: boolean;
  objective?: string;
}) {
  const action = mapStepToExecutionAction({
    stepId: "sim_step",
    stepType: "search",
    objective: input.objective || "simular feedback"
  });
  return ProcessExecutionFeedbackService({
    companyId: input.companyId,
    actionId: action.id,
    stepId: "step_1",
    runtimeRequestId: "rreq_sim",
    runtimeResultId: "rres_sim",
    runtimeResult: {
      status: input.runtimeStatus || "success",
      errors: [],
      warnings: [],
      modelResult: { data: { query: input.objective || "sim" } },
      toolId: "knowledge.search"
    },
    actionResult: {
      status: input.actionStatus || "SUCCESS",
      validation: input.validation || "VALID",
      errors: [],
      warnings: []
    },
    requiresConfirmation: input.requiresConfirmation,
    stepRetryable: input.stepRetryable,
    stepOptional: input.stepOptional
  });
}

export async function ReplayExecutionFeedbackService(input: {
  companyId: number;
  userId?: number | null;
  text?: string;
  sessionId?: string;
}): Promise<{
  replay: {
    runtime: Awaited<
      ReturnType<typeof ReplayRuntimeIntegrationService>
    >["replay"];
    feedbackSlices: FeedbackReplaySlice[];
  };
}> {
  const { replay } = await ReplayRuntimeIntegrationService({
    companyId: input.companyId,
    userId: input.userId,
    text: input.text,
    sessionId: input.sessionId
  });

  const engine = new ExecutionFeedbackEngine();
  const feedbackSlices: FeedbackReplaySlice[] = [];

  let session: ExecutionSession =
    (replay.cognitive as any)?.session ||
    buildSyntheticSession({ companyId: input.companyId });

  for (const slice of replay.runtimeSlices || []) {
    const record = engine.process({
      companyId: input.companyId,
      session,
      actionId: slice.action.id,
      stepId: slice.action.stepId,
      runtimeRequestId: slice.request.requestId,
      runtimeResultId: slice.adapterResult.toolId || slice.request.requestId,
      runtimeResult: slice.adapterResult as unknown as Record<string, unknown>,
      actionResult: slice.actionResult as unknown as Record<string, unknown>,
      entities: slice.action.entities,
      constraints: slice.action.constraints,
      stepRetryable: slice.action.retryable,
      requiresConfirmation: slice.action.requiresConfirmation
    });
    session = (record as any).updatedSession as ExecutionSession;
    feedbackSlices.push({
      runtimeResult: slice.adapterResult as unknown as Record<string, unknown>,
      feedback: record.feedback,
      sessionUpdate: record.sessionUpdate,
      finalState: record.sessionUpdate.nextStatus
    });
  }

  const replays = replaysByCompany.get(input.companyId) || [];
  pushCap(replays, {
    id: `fbreplay_${createHash("sha256")
      .update(`${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    slices: feedbackSlices,
    createdAt: new Date().toISOString()
  });
  replaysByCompany.set(input.companyId, replays);

  return {
    replay: {
      runtime: replay,
      feedbackSlices
    }
  };
}

export function __resetExecutionFeedbackAdminForTests(): void {
  replaysByCompany.clear();
  __resetExecutionSessionsForTests();
}

export default {
  ProcessExecutionFeedbackService,
  GetExecutionFeedbackDashboardService
};
