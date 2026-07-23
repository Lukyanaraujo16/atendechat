/**
 * AI Agent V2.6 — Cognitive Memory Engine tests
 */
import {
  MEMORY_TYPES,
  MEMORY_EVENTS
} from "../../../../../config/automationCognitiveMemoryConstants";
import { buildKnowledgeFromFeedback } from "../KnowledgeBuilder";
import { CognitiveMemoryEngine } from "../CognitiveMemoryEngine";
import { SqlMemoryProvider } from "../providers/SqlMemoryProvider";
import stubVector from "../providers/StubVectorProvider";
import { MemoryRetriever } from "../MemoryRetriever";
import { scoreMemoryObject, __resetMemoryScoringForTests } from "../MemoryScoring";
import {
  __resetCognitiveMemoryConfigForTests,
  getCognitiveMemoryConfig,
  setCognitiveMemoryConfig
} from "../CognitiveMemoryConfig";
import { __resetCognitiveMemoryMetricsForTests } from "../CognitiveMemoryMetrics";
import {
  __resetCognitiveMemoryAdminForTests,
  CreateMemoryService,
  GetCognitiveMemoryDashboardService,
  QueryMemoryService,
  BuildKnowledgeTesterService
} from "../CognitiveMemoryAdminServices";
import { ExecutionFeedback } from "../../feedback/feedbackTypes";
import * as FeedbackAdmin from "../../feedback/ExecutionFeedbackAdminServices";

function sampleFeedback(overrides: Partial<ExecutionFeedback> = {}): ExecutionFeedback {
  return {
    feedbackId: "fb_1",
    sessionId: "sess_1",
    actionId: "act_1",
    runtimeRequestId: "rreq_1",
    runtimeResultId: "rres_1",
    goalProgress: {
      completedSteps: 1,
      pendingSteps: 1,
      failedSteps: 0,
      completionPercentage: 50,
      goalAchieved: false
    },
    stepStatus: "SUCCESS",
    executionState: "RUNNING",
    recoveryDecision: "NONE",
    nextDecision: "CONTINUE",
    humanIntervention: { required: false, kind: "NONE", reason: null },
    replanRequired: false,
    knowledge: {
      entitiesFound: [{ key: "query", value: "produto" }],
      entitiesMissing: [],
      changesMade: ["tool:knowledge.search"],
      constraintsFound: [],
      warnings: [],
      errors: []
    },
    confidence: 0.9,
    summary: "step=SUCCESS; next=CONTINUE",
    metadata: { executesTools: false },
    ...overrides
  };
}

describe("Cognitive Memory Engine V2.6", () => {
  let provider: SqlMemoryProvider;
  let engine: CognitiveMemoryEngine;

  beforeEach(() => {
    __resetCognitiveMemoryConfigForTests();
    __resetCognitiveMemoryMetricsForTests();
    __resetCognitiveMemoryAdminForTests();
    __resetMemoryScoringForTests();
    provider = new SqlMemoryProvider();
    engine = new CognitiveMemoryEngine({ provider });
    jest.restoreAllMocks();
  });

  it("memory types e events definidos", () => {
    expect(MEMORY_TYPES).toEqual(
      expect.arrayContaining([
        "WORKING",
        "EPISODIC",
        "SEMANTIC",
        "PROCEDURAL",
        "REFLECTION"
      ])
    );
    expect(MEMORY_EVENTS).toContain("KNOWLEDGE_CREATED");
  });

  it("KnowledgeBuilder gera objetos a partir de Feedback", () => {
    const objects = buildKnowledgeFromFeedback({
      tenantId: 1,
      feedback: sampleFeedback()
    });
    const types = objects.map(o => o.memoryType);
    expect(types).toContain("WORKING");
    expect(types).toContain("EPISODIC");
    expect(types).toContain("SEMANTIC");
    expect(types).toContain("PROCEDURAL");
    expect(objects.every(o => o.tenantId === 1)).toBe(true);
    expect(objects.every(o => o.metadata.usesEmbeddings === false)).toBe(true);
  });

  it("KnowledgeBuilder inclui Reflection em falha", () => {
    const objects = buildKnowledgeFromFeedback({
      tenantId: 1,
      feedback: sampleFeedback({
        stepStatus: "FAILED",
        recoveryDecision: "RETRY",
        knowledge: {
          entitiesFound: [],
          entitiesMissing: [],
          changesMade: [],
          constraintsFound: [],
          warnings: [],
          errors: ["boom"]
        }
      })
    });
    expect(objects.some(o => o.memoryType === "REFLECTION")).toBe(true);
  });

  it("Memory Engine save/get/update/delete/version", async () => {
    const [obj] = buildKnowledgeFromFeedback({
      tenantId: 2,
      feedback: sampleFeedback({ feedbackId: "fb_eng" })
    });
    const { object: saved } = await engine.save(obj);
    expect(saved.id).toBeTruthy();

    const got = await engine.get(2, saved.id);
    expect(got?.title).toBe(saved.title);

    const { object: updated } = await engine.update(2, saved.id, {
      title: "Updated title"
    });
    expect(updated?.version).toBe(2);
    expect(updated?.title).toBe("Updated title");

    const { deleted } = await engine.delete(2, saved.id);
    expect(deleted).toBe(true);
    expect(await engine.get(2, saved.id)).toBeNull();
  });

  it("SQL Provider isola tenants", async () => {
    const a = buildKnowledgeFromFeedback({
      tenantId: 10,
      feedback: sampleFeedback({ feedbackId: "t10" })
    })[0];
    const b = buildKnowledgeFromFeedback({
      tenantId: 20,
      feedback: sampleFeedback({ feedbackId: "t20" })
    })[0];
    await provider.save(a);
    await provider.save(b);

    const list10 = await provider.list(10);
    const list20 = await provider.list(20);
    expect(list10.every(o => o.tenantId === 10)).toBe(true);
    expect(list20.every(o => o.tenantId === 20)).toBe(true);
    expect(await provider.getById(10, b.id)).toBeNull();
  });

  it("VectorProvider ainda não implementado", async () => {
    expect(stubVector.implemented).toBe(false);
    await expect(stubVector.searchSimilar()).rejects.toThrow(
      /VECTOR_NOT_IMPLEMENTED/
    );
  });

  it("Memory Query + Retriever + Scoring", async () => {
    const objects = buildKnowledgeFromFeedback({
      tenantId: 3,
      feedback: sampleFeedback({ feedbackId: "q1" })
    });
    await engine.saveMany(objects);

    const retriever = new MemoryRetriever(provider);
    const scored = await retriever.retrieve({
      tenantId: 3,
      text: "SUCCESS",
      limit: 10
    });
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0].score).toBeGreaterThan(0);
    expect(scored[0].scoreBreakdown).toBeTruthy();

    const single = scoreMemoryObject({
      tenantId: 3,
      object: objects[0]
    });
    expect(single.scoreBreakdown.importance).toBeGreaterThanOrEqual(0);
  });

  it("Query API força tenantId da empresa", async () => {
    await CreateMemoryService({
      companyId: 7,
      feedback: sampleFeedback({ feedbackId: "iso" })
    });
    const { results } = await QueryMemoryService({
      companyId: 7,
      query: { tenantId: 999 as any, text: "Working" }
    });
    expect(results.every(r => r.object.tenantId === 7)).toBe(true);
  });

  it("dashboard agrega por tipo", async () => {
    await CreateMemoryService({
      companyId: 8,
      feedback: sampleFeedback({ feedbackId: "dash" })
    });
    const dash = await GetCognitiveMemoryDashboardService({ companyId: 8 });
    expect(dash.working).toBeGreaterThanOrEqual(1);
    expect(dash.episodic).toBeGreaterThanOrEqual(1);
    expect(dash.vectorEnabled).toBe(false);
    expect(dash.usesEmbeddings).toBe(false);
    expect(dash.storageProvider).toBe("SQL");
  });

  it("config administrativa sem hardcode", () => {
    setCognitiveMemoryConfig(9, {
      limits: { maxResultsPerQuery: 7 }
    } as any);
    const cfg = getCognitiveMemoryConfig(9);
    expect(cfg.limits.maxResultsPerQuery).toBe(7);
    expect(cfg.usesEmbeddings).toBe(false);
  });

  it("Knowledge Builder Tester", async () => {
    const result = await BuildKnowledgeTesterService({
      companyId: 11,
      feedback: sampleFeedback({ feedbackId: "tester" })
    });
    expect(result.objects.length).toBeGreaterThan(0);
    expect(result.usesEmbeddings).toBe(false);
  });

  it("replay Feedback → Knowledge → Memory", async () => {
    jest.spyOn(FeedbackAdmin, "ReplayExecutionFeedbackService").mockResolvedValue({
      replay: {
        runtime: {} as any,
        feedbackSlices: [
          {
            runtimeResult: {},
            feedback: sampleFeedback({ feedbackId: "rp1" }),
            sessionUpdate: {
              sessionId: "s",
              previousStatus: "RUNNING",
              nextStatus: "RUNNING",
              currentStepId: "s1",
              completedSteps: ["s1"],
              failedSteps: [],
              pendingSteps: [],
              waitingSteps: [],
              metrics: {},
              timelineAppended: 1,
              historyEntry: {
                feedbackId: "rp1",
                stepId: "s1",
                stepStatus: "SUCCESS",
                at: new Date().toISOString()
              }
            },
            finalState: "RUNNING"
          }
        ]
      }
    });

    const { ReplayCognitiveMemoryService } = await import(
      "../CognitiveMemoryAdminServices"
    );
    const { replay } = await ReplayCognitiveMemoryService({
      companyId: 12,
      text: "produto"
    });
    expect(replay.memorySlices.length).toBe(1);
    expect(replay.memorySlices[0].knowledgeObjects.length).toBeGreaterThan(0);
    expect(replay.memorySlices[0].savedIds.length).toBeGreaterThan(0);
  });
});
