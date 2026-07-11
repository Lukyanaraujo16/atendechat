import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import * as AiAgentController from "../controllers/AiAgentController";

const aiAgentRoutes = Router();

aiAgentRoutes.get(
  "/ai-agents",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.index
);

aiAgentRoutes.get(
  "/ai-agents/shadow-suggestions/summary",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.shadowSuggestionsSummary
);

aiAgentRoutes.get(
  "/ai-agents/shadow-suggestions",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.shadowSuggestions
);

aiAgentRoutes.post(
  "/ai-agents/shadow-suggestions/:id/review",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.upsertShadowSuggestionReview
);

aiAgentRoutes.get(
  "/ai-agents/:id/profile",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.showProfile
);

aiAgentRoutes.put(
  "/ai-agents/:id/profile",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.upsertProfile
);

aiAgentRoutes.post(
  "/ai-agents/:id/profile/preview",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.previewProfilePrompt
);

aiAgentRoutes.get(
  "/ai-agents/:id",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.show
);

aiAgentRoutes.post(
  "/ai-agents",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.store
);

aiAgentRoutes.put(
  "/ai-agents/:id",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.update
);

aiAgentRoutes.delete(
  "/ai-agents/:id",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiAgentController.remove
);

export default aiAgentRoutes;
