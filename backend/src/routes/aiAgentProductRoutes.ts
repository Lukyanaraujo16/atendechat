import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireAiAgentProductView from "../middleware/requireAiAgentProductView";
import * as AiAgentProductController from "../controllers/AiAgentProductController";

/**
 * Product API — Agente de IA (Fases 2.0–2.2).
 * isAuth + admin. Sem permissões AgentOS. supportMode não autoriza.
 */
const aiAgentProductRoutes = Router();

aiAgentProductRoutes.get(
  "/product/ai-agent/summary",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.summary
);

aiAgentProductRoutes.get(
  "/product/ai-agent/readiness",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.readiness
);

aiAgentProductRoutes.post(
  "/product/ai-agent/commands",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.command
);

export default aiAgentProductRoutes;
