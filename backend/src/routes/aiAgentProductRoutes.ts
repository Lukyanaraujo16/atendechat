import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireAiAgentProductView from "../middleware/requireAiAgentProductView";
import * as AiAgentProductController from "../controllers/AiAgentProductController";

/**
 * Product API — Agente de IA (Fases 2.0–2.3).
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

aiAgentProductRoutes.get(
  "/product/ai-agent/configuration",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.getConfiguration
);

aiAgentProductRoutes.post(
  "/product/ai-agent/configuration",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.createConfiguration
);

aiAgentProductRoutes.put(
  "/product/ai-agent/configuration",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.updateConfiguration
);

aiAgentProductRoutes.get(
  "/product/ai-agent/configuration/options",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.getConfigurationOptions
);

aiAgentProductRoutes.put(
  "/product/ai-agent/configuration/connections",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.updateConnections
);

export default aiAgentProductRoutes;
