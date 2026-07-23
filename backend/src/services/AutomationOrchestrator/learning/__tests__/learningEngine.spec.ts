/**
 * AI Agent V2.8 — Learning Engine tests
 */
import { getLearningConfig, __resetLearningConfigForTests, setLearningConfig } from "../LearningConfig";
import { __resetLearningStoreForTests, learningStore } from "../stores/LearningStore";
import { __resetLearningEventsForTests } from "../LearningEvents";
import { __resetLearningMetricsForTests, getLearningMetricsBase } from "../metrics/LearningMetrics";
import { collectLearningDataset, sanitizeValue } from "../collector/LearningDataCollector";
import { evaluateLearningDataQuality } from "../collector/LearningDataQualityEvaluator";
import { detectLearningPatterns } from "../patterns/PatternDetectionEngine";
import { buildLearningCandidates } from "../candidates/LearningCandidateBuilder";
import { deduplicateLearningCandidates } from "../candidates/LearningDeduplicationService";
import { evaluateLearningCandidate } from "../evaluation/LearningEvaluationEngine";
import { detectLearningConflicts } from "../conflicts/LearningConflictDetector";
import { decideLearningPromotion } from "../promotion/LearningPromotionPolicyEngine";
import { applyTemporalDecay, invalidateLearningCandidate } from "../decay/TemporalDecay";
import { LearningEngine } from "../LearningEngine";
import { GetLearningDashboardService } from "../admin/LearningAdminServices";
import { ExecutionHistorySample } from "../types";
import { DEFAULT_LEARNING_CONFIG } from "../../../../config/automationLearningConstants";

function samplesFor(companyHint: string): ExecutionHistorySample[] {
  const base = new Date().toISOString();
  return [
    {
      sessionId: `${companyHint}_s1`,
      executionId: `${companyHint}_e1`,
      capability: "SEARCH_CONTACT",
      runtimeType: "MCP",
      mcpTool: "search_customer",
      status: "failure",
      errorCode: "ERR_MCP_TIMEOUT",
      recovery: true,
      replan: true,
      humanIntervention: true,
      latencyMs: 7000,
      timestamp: base
    },
    {
      sessionId: `${companyHint}_s2`,
      executionId: `${companyHint}_e2`,
      capability: "SEARCH_CONTACT",
      runtimeType: "MCP",
      status: "failure",
      errorCode: "ERR_MCP_TIMEOUT",
      fallbackUsed: true,
      recovery: true,
      replan: true,
      timestamp: base
    },
    {
      sessionId: `${companyHint}_s3`,
      executionId: `${companyHint}_e3`,
      capability: "SEARCH_CONTACT",
      runtimeType: "TOOL_RUNTIME",
      status: "success",
      strategy: "search_then_validate",
      timestamp: base
    },
    {
      sessionId: `${companyHint}_s4`,
      executionId: `${companyHint}_e4`,
      capability: "SEARCH_CONTACT",
      runtimeType: "MCP",
      status: "failure",
      errorCode: "ERR_MCP_TIMEOUT",
      replan: true,
      humanIntervention: true,
      recovery: true,
      timestamp: base
    },
    {
      sessionId: `${companyHint}_s5`,
      executionId: `${companyHint}_e5`,
      capability: "SEARCH_CONTACT",
      runtimeType: "TOOL_RUNTIME",
      status: "success",
      strategy: "search_then_validate",
      confirmationApproved: true,
      timestamp: base
    },
    {
      sessionId: `${companyHint}_s6`,
      executionId: `${companyHint}_e6`,
      capability: "SEARCH_CONTACT",
      runtimeType: "TOOL_RUNTIME",
      status: "success",
      strategy: "search_then_validate",
      knowledgeGap: true,
      timestamp: base
    }
  ];
}

describe("Learning Engine V2.8", () => {
  beforeEach(() => {
    __resetLearningConfigForTests();
    __resetLearningStoreForTests();
    __resetLearningEventsForTests();
    __resetLearningMetricsForTests();
  });

  it("config defaults: autoPromotion false, no live", () => {
    const cfg = getLearningConfig(1);
    expect(cfg.autoPromotionEnabled).toBe(false);
    expect(cfg.liveIntegrationEnabled).toBe(false);
    expect(cfg.productionPromotionEnabled).toBe(false);
    expect(DEFAULT_LEARNING_CONFIG.usesGenerativeAi).toBe(false);
  });

  it("dataset tenant-scoped + sanitização", () => {
    const ds1 = collectLearningDataset({
      companyId: 1,
      scopeType: "TENANT",
      scopeId: "1",
      samples: samplesFor("c1")
    });
    const ds2 = collectLearningDataset({
      companyId: 2,
      scopeType: "TENANT",
      scopeId: "2",
      samples: samplesFor("c2")
    });
    expect(ds1.companyId).toBe(1);
    expect(ds2.companyId).toBe(2);
    const sanitized = sanitizeValue({
      token: "secret",
      apiKey: "x",
      query: "ana"
    }) as any;
    expect(sanitized.token).toBe("[redacted]");
    expect(sanitized.apiKey).toBe("[redacted]");
    expect(sanitized.query).toBe("ana");
    expect(ds1.evidence.every(e => e.sanitized && e.tenantVerified)).toBe(true);
  });

  it("qualidade insuficiente e válida", () => {
    const low = evaluateLearningDataQuality({
      companyId: 1,
      sampleSize: 1,
      evidence: [],
      successCount: 0,
      failureCount: 1,
      partialCount: 0,
      humanInterventionCount: 0,
      uniqueCapabilities: 1,
      uniqueSessions: 1
    });
    expect(low.level).toBe("INSUFFICIENT");
    expect(low.usableForPromotion).toBe(false);

    const ds = collectLearningDataset({
      companyId: 1,
      scopeType: "TENANT",
      scopeId: "1",
      samples: samplesFor("q")
    });
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(ds.dataQuality.level);
  });

  it("detecta padrões failure/success/recovery/replan/human/runtime/mcp", () => {
    setLearningConfig(3, {
      patternThresholds: {
        ...getLearningConfig(3).patternThresholds,
        successfulStrategyRate: 0.4
      }
    });
    const ds = collectLearningDataset({
      companyId: 3,
      scopeType: "AGENT",
      scopeId: "10",
      samples: samplesFor("p")
    });
    const patterns = detectLearningPatterns({
      companyId: 3,
      dataset: ds,
      samples: samplesFor("p")
    });
    const types = patterns.map(p => p.patternType);
    expect(types).toEqual(
      expect.arrayContaining([
        "RECURRING_FAILURE",
        "SUCCESSFUL_STRATEGY",
        "FREQUENT_RECOVERY",
        "FREQUENT_REPLAN",
        "HUMAN_INTERVENTION_PATTERN",
        "RUNTIME_SELECTION_PATTERN",
        "MCP_FAILURE_PATTERN"
      ])
    );
  });

  it("cria candidatos, dedup e atualiza evidências", () => {
    const ds = collectLearningDataset({
      companyId: 4,
      scopeType: "TENANT",
      scopeId: "4",
      samples: samplesFor("d")
    });
    const patterns = detectLearningPatterns({
      companyId: 4,
      dataset: ds,
      samples: samplesFor("d")
    });
    const built = buildLearningCandidates({
      companyId: 4,
      dataset: ds,
      patterns
    });
    expect(built.length).toBeGreaterThan(0);
    const again = buildLearningCandidates({
      companyId: 4,
      dataset: ds,
      patterns
    });
    const { created, updated } = deduplicateLearningCandidates({
      companyId: 4,
      existing: built,
      incoming: again
    });
    expect(created.length).toBe(0);
    expect(updated.length).toBeGreaterThan(0);
    expect(updated[0].version).toBeGreaterThan(1);
  });

  it("avaliação insuficiente / review / alto risco", () => {
    const low = evaluateLearningCandidate({
      companyId: 5,
      candidate: {
        id: "c1",
        companyId: 5,
        agentId: null,
        candidateType: "ALERT_ONLY",
        title: "t",
        description: "d",
        scope: "TENANT",
        target: "x",
        proposedChange: {},
        currentState: {},
        expectedBenefit: "",
        possibleRisks: [],
        evidenceIds: [],
        patternIds: [],
        sampleSize: 1,
        confidence: 0.2,
        impact: 0.2,
        risk: 0.2,
        reversibility: 1,
        dataQuality: "INSUFFICIENT",
        status: "DRAFT",
        createdBy: null,
        reviewedBy: null,
        reviewedAt: null,
        promotedAt: null,
        expiresAt: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      }
    });
    expect(low.decision).toBe("INSUFFICIENT_DATA");

    const policy = evaluateLearningCandidate({
      companyId: 5,
      candidate: {
        id: "c2",
        companyId: 5,
        agentId: null,
        candidateType: "POLICY_RECOMMENDATION",
        title: "policy",
        description: "d",
        scope: "TENANT",
        target: "policy",
        proposedChange: { observeOnly: true },
        currentState: {},
        expectedBenefit: "",
        possibleRisks: ["high"],
        evidenceIds: ["a", "b", "c"],
        patternIds: ["p"],
        sampleSize: 10,
        confidence: 0.8,
        impact: 0.5,
        risk: 0.8,
        reversibility: 0.5,
        dataQuality: "HIGH",
        status: "DRAFT",
        createdBy: null,
        reviewedBy: null,
        reviewedAt: null,
        promotedAt: null,
        expiresAt: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {}
      }
    });
    expect(policy.decision).toBe("REQUIRES_SUPERADMIN_APPROVAL");
  });

  it("conflito entre runtime preferences", () => {
    const a: any = {
      id: "a",
      companyId: 6,
      candidateType: "RUNTIME_PREFERENCE",
      target: "SEARCH_CONTACT",
      proposedChange: { preference: "MCP_FIRST" },
      status: "APPROVED",
      metadata: {}
    };
    const b: any = {
      id: "b",
      companyId: 6,
      candidateType: "RUNTIME_PREFERENCE",
      target: "SEARCH_CONTACT",
      proposedChange: { preference: "TOOL_RUNTIME_FIRST" },
      status: "READY_FOR_REVIEW",
      metadata: {}
    };
    const conflicts = detectLearningConflicts({
      companyId: 6,
      candidate: b,
      others: [a]
    });
    expect(conflicts.some(c => c.startsWith("runtime_preference_conflict"))).toBe(
      true
    );
  });

  it("pipeline approve + shadow promote + knowledge + rollback + invalidate", async () => {
    const engine = new LearningEngine();
    const analyzed = await engine.analyze({
      companyId: 7,
      scopeType: "TENANT",
      scopeId: "7",
      mode: "MANUAL",
      samples: samplesFor("flow")
    });
    expect(analyzed.candidates.length).toBeGreaterThan(0);

    const cand = analyzed.candidates.find(
      c => c.candidateType === "RUNTIME_PREFERENCE" || c.candidateType === "ALERT_ONLY"
    )!;
    const evaluated = engine.evaluateCandidate({
      companyId: 7,
      candidateId: cand.id
    });
    expect(evaluated.evaluation).toBeTruthy();

    const approved = engine.approveCandidate({
      companyId: 7,
      candidateId: cand.id,
      userId: 1
    });
    expect(approved.candidate.status).toBe("APPROVED");

    const decisionBlocked = decideLearningPromotion({
      companyId: 7,
      candidate: approved.candidate,
      evaluation: evaluated.evaluation,
      explicitApprove: false,
      requestedMode: "SHADOW"
    });
    expect(decisionBlocked.allowed).toBe(false);

    const promoted = await engine.promoteCandidate({
      companyId: 7,
      candidateId: cand.id,
      userId: 1,
      requestedMode: "SHADOW"
    });
    expect(promoted.decision.allowed).toBe(true);
    expect(promoted.artifact?.environment).toBe("SHADOW");
    expect(promoted.artifact?.metadata.liveIntegrationEnabled).toBe(false);

    const shadow = engine.shadowCompare({
      companyId: 7,
      candidateId: cand.id,
      sourceExecutionId: "flow_e1",
      originalDecision: { runtimeType: "MCP" }
    });
    expect(shadow.comparison.metadata.historicalExecutionUnchanged).toBe(true);

    const rolled = engine.rollbackPromotion({
      companyId: 7,
      artifactId: promoted.artifact!.id,
      reason: "test"
    });
    expect(rolled.artifact.status).toBe("ROLLED_BACK");

    const invalidated = engine.invalidateCandidate({
      companyId: 7,
      candidateId: analyzed.candidates[0].id,
      reason: "schema_changed"
    });
    expect(invalidated.candidate.status).toBe("INVALIDATED");
  });

  it("autoPromotion permanece desabilitado mesmo via setConfig", () => {
    const cfg = setLearningConfig(8, { autoPromotionEnabled: true as any });
    expect(cfg.autoPromotionEnabled).toBe(false);
  });

  it("temporal decay e feedback humano", async () => {
    const engine = new LearningEngine();
    const analyzed = await engine.analyze({
      companyId: 9,
      scopeType: "TENANT",
      scopeId: "9",
      samples: samplesFor("dec")
    });
    const cand = analyzed.candidates[0];
    learningStore(9).putCandidate({
      ...cand,
      createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() - 86400000).toISOString()
    });
    const decay = applyTemporalDecay({
      companyId: 9,
      candidate: learningStore(9).getCandidate(cand.id)!
    });
    expect(["STALE", "EXPIRED", "NEEDS_REVALIDATION"]).toContain(decay.mark);

    const fb = engine.addHumanFeedback({
      companyId: 9,
      userId: 2,
      candidateId: cand.id,
      rating: 4,
      classification: "USEFUL",
      isAdmin: true
    });
    expect(fb.feedback.weight).toBeGreaterThan(0.5);
  });

  it("isolamento entre tenants + dashboard flags", async () => {
    const engine = new LearningEngine();
    await engine.analyze({
      companyId: 10,
      scopeType: "TENANT",
      scopeId: "10",
      samples: samplesFor("t10")
    });
    await engine.analyze({
      companyId: 11,
      scopeType: "TENANT",
      scopeId: "11",
      samples: samplesFor("t11")
    });
    expect(learningStore(10).listCandidates().every(c => c.companyId === 10)).toBe(
      true
    );
    expect(learningStore(11).getCandidate(learningStore(10).listCandidates()[0]?.id || "x")).toBeNull();

    const dash = await GetLearningDashboardService({ companyId: 10 });
    expect(dash.liveIntegrationEnabled).toBe(false);
    expect(dash.autoPromotionEnabled).toBe(false);
    expect(dash.executesTools).toBe(false);
    expect(dash.executesMcp).toBe(false);
    expect(dash.modifiesPlanner).toBe(false);
    expect(getLearningMetricsBase().analysesCompleted).toBeGreaterThan(0);
  });

  it("KnowledgeObject reflection/procedural via memory engine em promote", async () => {
    const engine = new LearningEngine();
    const analyzed = await engine.analyze({
      companyId: 12,
      scopeType: "TENANT",
      scopeId: "12",
      samples: samplesFor("ko")
    });
    const recovery = analyzed.candidates.find(
      c =>
        c.candidateType === "RECOVERY_RECOMMENDATION" ||
        c.candidateType === "KNOWLEDGE_GAP" ||
        c.candidateType === "ALERT_ONLY"
    );
    if (!recovery) return;
    engine.evaluateCandidate({ companyId: 12, candidateId: recovery.id });
    engine.approveCandidate({ companyId: 12, candidateId: recovery.id, userId: 1 });
    const promoted = await engine.promoteCandidate({
      companyId: 12,
      candidateId: recovery.id,
      userId: 1,
      requestedMode: "SHADOW"
    });
    if (promoted.knowledgeObject) {
      expect(["PROCEDURAL", "REFLECTION"]).toContain(
        promoted.knowledgeObject.memoryType
      );
      expect(promoted.knowledgeObject.tenantId).toBe(12);
    }
  });
});
