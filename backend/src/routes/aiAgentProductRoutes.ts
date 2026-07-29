import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireAiAgentProductView from "../middleware/requireAiAgentProductView";
import * as AiAgentProductController from "../controllers/AiAgentProductController";

/**
 * Product API — Agente de IA (Fase 2.0 / hardening 2.0.1).
 * Estratégia A: isAuth + admin (mesmo gate visual do módulo).
 * Sem permissões de plataforma AgentOS. supportMode não autoriza.
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

export default aiAgentProductRoutes;
