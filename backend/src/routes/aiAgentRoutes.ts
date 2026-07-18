import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import * as AiAgentController from "../controllers/AiAgentController";
import { KNOWLEDGE_BASE_FEATURE_KEY } from "../config/knowledgeBaseConstants";

const aiAgentRoutes = Router();
const requireAiAgent = requireEffectiveModule("automation.ai_agent");
const requireKnowledgeBase = requireEffectiveModule(KNOWLEDGE_BASE_FEATURE_KEY);

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
  AiAgentController.upsertShadowSuggestionReview
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
  AiAgentController.upsertProfile
);

aiAgentRoutes.post(
  "/ai-agents/:id/profile/preview",
  isAuth,
  requireAiAgent,
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
  AiAgentController.sendSimulatorMessage
);

aiAgentRoutes.post(
  "/ai-agents/:id/simulator/sessions/:sessionId/end",
  isAuth,
  requireAiAgent,
  AiAgentController.endSimulatorSession
);

aiAgentRoutes.post(
  "/ai-agents/:id/simulator/sessions/:sessionId/messages/:messageId/review",
  isAuth,
  requireAiAgent,
  AiAgentController.upsertSimulatorMessageReview
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
  AiAgentController.store
);

aiAgentRoutes.put(
  "/ai-agents/:id",
  isAuth,
  requireAiAgent,
  AiAgentController.update
);

aiAgentRoutes.delete(
  "/ai-agents/:id",
  isAuth,
  requireAiAgent,
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
  AiAgentController.upsertKnowledgeSettings
);

aiAgentRoutes.post(
  "/ai-agents/:id/knowledge-retrieval/test",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  AiAgentController.testKnowledgeRetrieval
);

aiAgentRoutes.get(
  "/ai-agents/:id/knowledge-retrievals",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  AiAgentController.listKnowledgeRetrievals
);

aiAgentRoutes.get(
  "/ai-agents/:id/knowledge-retrievals/:retrievalId",
  isAuth,
  requireAiAgent,
  requireKnowledgeBase,
  AiAgentController.showKnowledgeRetrieval
);

export default aiAgentRoutes;
