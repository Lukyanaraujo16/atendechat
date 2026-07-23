import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationLearningController";

const routes = Router();
const mw = agentOsStacks.learning()

routes.post("/automation/learning/analyze", ...mw, Ctrl.analyze);
routes.post(
  "/automation/learning/analyze/session/:sessionId",
  ...mw,
  Ctrl.analyzeSession
);
routes.post(
  "/automation/learning/analyze/goal/:goalId",
  ...mw,
  Ctrl.analyzeGoal
);
routes.post(
  "/automation/learning/analyze/agent/:agentId",
  ...mw,
  Ctrl.analyzeAgent
);
routes.get("/automation/learning/analyses", ...mw, Ctrl.listAnalyses);
routes.get("/automation/learning/analyses/:id", ...mw, Ctrl.getAnalysis);

routes.get("/automation/learning/datasets", ...mw, Ctrl.listDatasets);
routes.get("/automation/learning/datasets/:id", ...mw, Ctrl.getDataset);
routes.get("/automation/learning/patterns", ...mw, Ctrl.listPatterns);
routes.get("/automation/learning/patterns/:id", ...mw, Ctrl.getPattern);

routes.get("/automation/learning/candidates", ...mw, Ctrl.listCandidates);
routes.get("/automation/learning/candidates/:id", ...mw, Ctrl.getCandidate);
routes.post(
  "/automation/learning/candidates/:id/evaluate",
  ...mw,
  Ctrl.evaluateCandidate
);
routes.post(
  "/automation/learning/candidates/:id/approve",
  ...mw,
  Ctrl.approveCandidate
);
routes.post(
  "/automation/learning/candidates/:id/reject",
  ...mw,
  Ctrl.rejectCandidate
);
routes.post(
  "/automation/learning/candidates/:id/promote",
  ...mw,
  Ctrl.promoteCandidate
);
routes.post(
  "/automation/learning/candidates/:id/invalidate",
  ...mw,
  Ctrl.invalidateCandidate
);

routes.get("/automation/learning/artifacts", ...mw, Ctrl.listArtifacts);
routes.get("/automation/learning/artifacts/:id", ...mw, Ctrl.getArtifact);
routes.post(
  "/automation/learning/artifacts/:id/rollback",
  ...mw,
  Ctrl.rollbackArtifact
);

routes.post("/automation/learning/feedback", ...mw, Ctrl.addFeedback);
routes.get("/automation/learning/feedback", ...mw, Ctrl.listFeedback);

routes.post("/automation/learning/shadow", ...mw, Ctrl.shadow);
routes.get("/automation/learning/shadow", ...mw, Ctrl.listShadows);
routes.get("/automation/learning/shadow/:id", ...mw, Ctrl.getShadow);

routes.get("/automation/learning/metrics", ...mw, Ctrl.metrics);
routes.get("/automation/learning/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/learning/replay/:id", ...mw, Ctrl.replay);
routes.get("/automation/learning/guidance", ...mw, Ctrl.listGuidance);

routes.get("/automation/learning/config", ...mw, Ctrl.getConfig);
routes.put("/automation/learning/config", ...mw, Ctrl.putConfig);

routes.post("/automation/learning/simulate/quality", ...mw, Ctrl.simulateQuality);
routes.post(
  "/automation/learning/simulate/conflicts",
  ...mw,
  Ctrl.simulateConflicts
);
routes.post(
  "/automation/learning/simulate/promotion",
  ...mw,
  Ctrl.simulatePromotion
);
routes.post("/automation/learning/simulate/decay", ...mw, Ctrl.simulateDecay);
routes.post("/automation/learning/sanitize", ...mw, Ctrl.sanitizePayload);

export default routes;
