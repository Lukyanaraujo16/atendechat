import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import requireAgentOsTenantContext from "../middleware/requireAgentOsTenantContext";
import {
  requireAgentOsConsole,
  requireAgentOsManage
} from "../middleware/requirePlatformPermission";
import { logAgentOsTechnicalWrite } from "../middleware/logAgentOsTechnicalWrite";
import { rejectLegacyAiAgentCommercialMutation } from "../middleware/rejectLegacyAiAgentCommercialMutation";
import * as AiAgentController from "../controllers/AiAgentController";
import * as AiAgentAnalyticsController from "../controllers/AiAgentAnalyticsController";
import { KNOWLEDGE_BASE_FEATURE_KEY } from "../config/knowledgeBaseConstants";

const aiAgentRoutes = Router();
const requireAiAgent = requireEffectiveModule("automation.ai_agent");
const requireKnowledgeBase = requireEffectiveModule(KNOWLEDGE_BASE_FEATURE_KEY);
/** Técnico: Console (Fase 1.4) — analytics / shadow-fc UI. */
const techRead = [
  isAuth,
  requireAgentOsConsole,
  requireAgentOsTenantContext,
  requireAiAgent
];
const techReadKb = [...techRead, requireKnowledgeBase];
const techManage = [
  ...techRead,
  requireAgentOsManage,
  logAgentOsTechnicalWrite("agentOS.console.manage")
];
const techManageKb = [
  ...techReadKb,
  requireAgentOsManage,
  logAgentOsTechnicalWrite("agentOS.console.manage")
];

/** Fase 2.8B.2 — bloqueio comercial legado (após auth + feature gate). */
const blockAgent = rejectLegacyAiAgentCommercialMutation("ai_agent");
const blockKnowledge = rejectLegacyAiAgentCommercialMutation("ai_agent_knowledge");
const blockSimulator = rejectLegacyAiAgentCommercialMutation("ai_agent_simulator");
const blockShadowReview = rejectLegacyAiAgentCommercialMutation(
  "ai_agent_shadow_review"
);

aiAgentRoutes.get(
  "/ai-agents",
  isAuth,
  requireAiAgent,
  AiAgentController.index
);

aiAgentRoutes.get(
  "/ai-agents/shadow-suggestions/summary",
  isAuth,
  requireAiAgent,
  AiAgentController.shadowSuggestionsSummary
);

aiAgentRoutes.get(
  "/ai-agents/shadow-suggestions",
  isAuth,
  requireAiAgent,
  AiAgentController.shadowSuggestions
);

aiAgentRoutes.post(
  "/ai-agents/shadow-suggestions/:id/review",
  isAuth,
  requireAiAgent,
  blockShadowReview,
  AiAgentController.upsertShadowSuggestionReview
);

/* —— Fase IA 1.5.3: Analytics (técnico — Console Fase 1.4) —— */
aiAgentRoutes.get(
  "/ai-agents/analytics/dashboard",
  ...techReadKb,
  AiAgentAnalyticsController.dashboard
);

aiAgentRoutes.get(
  "/ai-agents/analytics/agents",
  ...techRead,
  AiAgentAnalyticsController.agentAnalytics
);

aiAgentRoutes.get(
  "/ai-agents/analytics/knowledge-bases",
  ...techReadKb,
  AiAgentAnalyticsController.knowledgeBaseAnalytics
);

aiAgentRoutes.get(
  "/ai-agents/analytics/documents",
  ...techReadKb,
  AiAgentAnalyticsController.documentAnalytics
);

aiAgentRoutes.get(
  "/ai-agents/analytics/health",
  ...techReadKb,
  AiAgentAnalyticsController.health
);

aiAgentRoutes.get(
  "/ai-agents/analytics/health-score",
  ...techReadKb,
  AiAgentAnalyticsController.healthScore
);

aiAgentRoutes.get(
  "/ai-agents/analytics/knowledge-gaps",
  ...techReadKb,
  AiAgentAnalyticsController.listGaps
);

aiAgentRoutes.patch(
  "/ai-agents/analytics/knowledge-gaps/:id",
  ...techManageKb,
  AiAgentAnalyticsController.updateGap
);

aiAgentRoutes.get(
  "/ai-agents/analytics/knowledge-suggestions",
  ...techReadKb,
  AiAgentAnalyticsController.listSuggestions
);

aiAgentRoutes.post(
  "/ai-agents/analytics/knowledge-suggestions",
  ...techManageKb,
  AiAgentAnalyticsController.createSuggestion
);

aiAgentRoutes.patch(
  "/ai-agents/analytics/knowledge-suggestions/:id",
  ...techManageKb,
  AiAgentAnalyticsController.updateSuggestion
);

aiAgentRoutes.get(
  "/ai-agents/analytics/replays",
  ...techRead,
  AiAgentAnalyticsController.listReplays
);

aiAgentRoutes.get(
  "/ai-agents/analytics/replays/:id",
  ...techRead,
  AiAgentAnalyticsController.showReplay
);

aiAgentRoutes.get(
  "/ai-agents/analytics/prompt-diff",
  ...techRead,
  AiAgentAnalyticsController.promptDiff
);

aiAgentRoutes.post(
  "/ai-agents/analytics/prompt-diff",
  ...techManage,
  AiAgentAnalyticsController.promptDiff
);

aiAgentRoutes.get(
  "/ai-agents/:id/profile",
  isAuth,
  requireAiAgent,
  AiAgentController.showProfile
);

aiAgentRoutes.put(
  "/ai-agents/:id/profile",
  isAuth,
  requireAiAgent,
  blockAgent,
  AiAgentController.upsertProfile
);

aiAgentRoutes.post(
  "/ai-agents/:id/profile/preview",
  isAuth,
  requireAiAgent,
  blockAgent,
  AiAgentController.previewProfilePrompt
);

aiAgentRoutes.get(
  "/ai-agents/:id/simulator/credential-check",
  isAuth,
  requireAiAgent,
  AiAgentController.simulatorCredentialCheck
);

aiAgentRoutes.post(
  "/ai-agents/:id/simulator/sessions",
  isAuth,
  requireAiAgent,
  blockSimulator,
  AiAgentController.createSimulatorSession
);

aiAgentRoutes.get(
  "/ai-agents/:id/simulator/sessions",
  isAuth,
  requireAiAgent,
  AiAgentController.listSimulatorSessions
);

aiAgentRoutes.get(
  "/ai-agents/:id/simulator/sessions/:sessionId",
  isAuth,
  requireAiAgent,
  AiAgentController.showSimulatorSession
);

aiAgentRoutes.post(
  "/ai-agents/:id/simulator/sessions/:sessionId/messages",
  isAuth,
  requireAiAgent,
  blockSimulator,
  AiAgentController.sendSimulatorMessage
);

aiAgentRoutes.post(
  "/ai-agents/:id/simulator/sessions/:sessionId/end",
  isAuth,
  requireAiAgent,
  blockSimulator,
  AiAgentController.endSimulatorSession
);

aiAgentRoutes.post(
  "/ai-agents/:id/simulator/sessions/:sessionId/messages/:messageId/review",
  isAuth,
  requireAiAgent,
  blockSimulator,
  AiAgentController.upsertSimulatorMessageReview
);

/* —— Fase IA 2.1E: Function Calling Shadow (técnico — Console) —— */
aiAgentRoutes.get(
  "/ai-agents/shadow-evaluations/dashboard",
  ...techRead,
  AiAgentController.shadowFcDashboard
);

aiAgentRoutes.get(
  "/ai-agents/shadow-evaluations",
  ...techRead,
  AiAgentController.listShadowEvaluations
);

aiAgentRoutes.get(
  "/ai-agents/shadow-evaluations/:id",
  ...techRead,
  AiAgentController.showShadowEvaluation
);

aiAgentRoutes.put(
  "/ai-agents/shadow-fc/company-setting",
  ...techManage,
  AiAgentController.upsertShadowFcCompanySetting
);

aiAgentRoutes.put(
  "/ai-agents/shadow-fc/connections/:whatsappId",
  ...techManage,
  AiAgentController.upsertShadowFcConnectionSetting
);

aiAgentRoutes.get(
  "/ai-agents/:id",
  isAuth,
  requireAiAgent,
  AiAgentController.show
);

aiAgentRoutes.post(
  "/ai-agents",
  isAuth,
  requireAiAgent,
  blockAgent,
  AiAgentController.store
);

aiAgentRoutes.put(
  "/ai-agents/:id",
  isAuth,
  requireAiAgent,
  blockAgent,
  AiAgentController.update
);

aiAgentRoutes.delete(
  "/ai-agents/:id",
  isAuth,
  requireAiAgent,
  blockAgent,
  AiAgentController.remove
);


aiAgentRoutes.get(
  "/ai-agents/:id/knowledge-bases",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  AiAgentController.listKnowledgeBases
);

aiAgentRoutes.put(
  "/ai-agents/:id/knowledge-bases",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  blockKnowledge,
  AiAgentController.syncKnowledgeBases
);

aiAgentRoutes.get(
  "/ai-agents/:id/knowledge-settings",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  AiAgentController.showKnowledgeSettings
);

aiAgentRoutes.put(
  "/ai-agents/:id/knowledge-settings",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  blockKnowledge,
  AiAgentController.upsertKnowledgeSettings
);

aiAgentRoutes.post(
  "/ai-agents/:id/knowledge-retrieval/test",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  blockKnowledge,
  AiAgentController.testKnowledgeRetrieval
);

aiAgentRoutes.get(
  "/ai-agents/:id/knowledge-retrievals",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  AiAgentController.listKnowledgeRetrievals
);

aiAgentRoutes.put(
  "/ai-agents/:id/shadow-fc/setting",
  ...techManage,
  AiAgentController.upsertShadowFcAgentSetting
);

aiAgentRoutes.get(
  "/ai-agents/:id/knowledge-retrievals/:retrievalId",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  AiAgentController.showKnowledgeRetrieval
);

export default aiAgentRoutes;
