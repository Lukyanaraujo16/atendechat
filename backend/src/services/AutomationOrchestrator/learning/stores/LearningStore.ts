import {
  HumanLearningFeedback,
  LearningAnalysis,
  LearningArtifact,
  LearningCandidate,
  LearningDataset,
  LearningEvaluationReport,
  LearningPattern,
  LearningShadowComparison,
  PlannerGuidance,
  RuntimeLearningGuidance,
  StrategyLearningGuidance
} from "../types";
import { persistLearningEntity } from "../../persistence/adapters/learningStorePersistence";

type TenantTables = {
  analyses: Map<string, LearningAnalysis>;
  datasets: Map<string, LearningDataset>;
  patterns: Map<string, LearningPattern>;
  candidates: Map<string, LearningCandidate>;
  evaluations: Map<string, LearningEvaluationReport>;
  artifacts: Map<string, LearningArtifact>;
  feedbacks: Map<string, HumanLearningFeedback>;
  shadows: Map<string, LearningShadowComparison>;
  plannerGuidance: Map<string, PlannerGuidance>;
  runtimeGuidance: Map<string, RuntimeLearningGuidance>;
  strategyGuidance: Map<string, StrategyLearningGuidance>;
};

const byCompany = new Map<number, TenantTables>();

function tables(companyId: number): TenantTables {
  if (!byCompany.has(companyId)) {
    byCompany.set(companyId, {
      analyses: new Map(),
      datasets: new Map(),
      patterns: new Map(),
      candidates: new Map(),
      evaluations: new Map(),
      artifacts: new Map(),
      feedbacks: new Map(),
      shadows: new Map(),
      plannerGuidance: new Map(),
      runtimeGuidance: new Map(),
      strategyGuidance: new Map()
    });
  }
  return byCompany.get(companyId)!;
}

export function learningStore(companyId: number) {
  const t = tables(companyId);
  return {
    putAnalysis: (a: LearningAnalysis) => {
      t.analyses.set(a.id, a);
      persistLearningEntity(companyId, "learning.analysis", a.id, a as any);
    },
    getAnalysis: (id: string) => t.analyses.get(id) || null,
    listAnalyses: () => Array.from(t.analyses.values()),
    putDataset: (d: LearningDataset) => {
      t.datasets.set(d.id, d);
      persistLearningEntity(companyId, "learning.dataset", d.id, d as any);
    },
    getDataset: (id: string) => t.datasets.get(id) || null,
    listDatasets: () => Array.from(t.datasets.values()),
    putPattern: (p: LearningPattern) => {
      t.patterns.set(p.id, p);
      persistLearningEntity(companyId, "learning.pattern", p.id, p as any);
    },
    getPattern: (id: string) => t.patterns.get(id) || null,
    listPatterns: () => Array.from(t.patterns.values()),
    putCandidate: (c: LearningCandidate) => {
      t.candidates.set(c.id, c);
      persistLearningEntity(companyId, "learning.candidate", c.id, c as any, {
        status: c.status
      });
    },
    getCandidate: (id: string) => t.candidates.get(id) || null,
    listCandidates: () => Array.from(t.candidates.values()),
    putEvaluation: (e: LearningEvaluationReport) => {
      t.evaluations.set(e.id, e);
      persistLearningEntity(companyId, "learning.evaluation", e.id, e as any);
    },
    getEvaluation: (id: string) => t.evaluations.get(id) || null,
    listEvaluations: () => Array.from(t.evaluations.values()),
    putArtifact: (a: LearningArtifact) => {
      t.artifacts.set(a.id, a);
      persistLearningEntity(companyId, "learning.artifact", a.id, a as any, {
        status: a.status
      });
    },
    getArtifact: (id: string) => t.artifacts.get(id) || null,
    listArtifacts: () => Array.from(t.artifacts.values()),
    putFeedback: (f: HumanLearningFeedback) => {
      t.feedbacks.set(f.id, f);
      persistLearningEntity(companyId, "learning.feedback", f.id, f as any);
    },
    listFeedbacks: () => Array.from(t.feedbacks.values()),
    putShadow: (s: LearningShadowComparison) => {
      t.shadows.set(s.id, s);
      persistLearningEntity(companyId, "learning.shadow", s.id, s as any);
    },
    getShadow: (id: string) => t.shadows.get(id) || null,
    listShadows: () => Array.from(t.shadows.values()),
    putPlannerGuidance: (key: string, g: PlannerGuidance) => {
      t.plannerGuidance.set(key, g);
      persistLearningEntity(
        companyId,
        "learning.planner_guidance",
        key,
        g as any
      );
    },
    listPlannerGuidance: () => Array.from(t.plannerGuidance.values()),
    putRuntimeGuidance: (key: string, g: RuntimeLearningGuidance) => {
      t.runtimeGuidance.set(key, g);
      persistLearningEntity(
        companyId,
        "learning.runtime_guidance",
        key,
        g as any
      );
    },
    listRuntimeGuidance: () => Array.from(t.runtimeGuidance.values()),
    putStrategyGuidance: (key: string, g: StrategyLearningGuidance) => {
      t.strategyGuidance.set(key, g);
      persistLearningEntity(
        companyId,
        "learning.strategy_guidance",
        key,
        g as any
      );
    },
    listStrategyGuidance: () => Array.from(t.strategyGuidance.values())
  };
}

export function __resetLearningStoreForTests(): void {
  byCompany.clear();
}

/** Wave 5 DB-first hydrate — maps entityType → collection. */
export function __hydrateLearningEntity(
  companyId: number,
  entityType: string,
  payload: Record<string, unknown>
): void {
  const t = tables(companyId);
  const id = String(payload.id || payload.key || "");
  if (!id) return;
  if (entityType.includes("candidate")) t.candidates.set(id, payload as any);
  else if (entityType.includes("artifact")) t.artifacts.set(id, payload as any);
  else if (entityType.includes("analysis")) t.analyses.set(id, payload as any);
  else if (entityType.includes("dataset")) t.datasets.set(id, payload as any);
  else if (entityType.includes("pattern")) t.patterns.set(id, payload as any);
}

export default { learningStore };
