import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireAiAgentProductView from "../middleware/requireAiAgentProductView";
import * as AiAgentProductController from "../controllers/AiAgentProductController";

/**
 * Product API — Agente de IA (Fases 2.0–2.5).
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

aiAgentProductRoutes.post(
  "/product/ai-agent/configuration/preview",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.previewConfiguration
);

aiAgentProductRoutes.put(
  "/product/ai-agent/configuration/connections",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.updateConnections
);

/** Product Credentials (Fase 2.7) — antes de rotas :param conflitantes. Sem DELETE. */
aiAgentProductRoutes.get(
  "/product/ai-agent/credentials",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.listCredentials
);

aiAgentProductRoutes.post(
  "/product/ai-agent/credentials",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.createCredential
);

aiAgentProductRoutes.get(
  "/product/ai-agent/credentials/:credentialRef",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.getCredential
);

aiAgentProductRoutes.put(
  "/product/ai-agent/credentials/:credentialRef",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.updateCredential
);

aiAgentProductRoutes.post(
  "/product/ai-agent/credentials/:credentialRef/test",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.testCredential
);

aiAgentProductRoutes.post(
  "/product/ai-agent/credentials/:credentialRef/enable",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.enableCredential
);

aiAgentProductRoutes.post(
  "/product/ai-agent/credentials/:credentialRef/disable",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.disableCredential
);

aiAgentProductRoutes.get(
  "/product/ai-agent/simulator",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.simulatorBootstrap
);

aiAgentProductRoutes.post(
  "/product/ai-agent/simulator/sessions",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.simulatorCreateSession
);

aiAgentProductRoutes.get(
  "/product/ai-agent/simulator/sessions",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.simulatorListSessions
);

aiAgentProductRoutes.get(
  "/product/ai-agent/simulator/sessions/:sessionRef",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.simulatorGetSession
);

aiAgentProductRoutes.post(
  "/product/ai-agent/simulator/sessions/:sessionRef/messages",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.simulatorSendMessage
);

aiAgentProductRoutes.post(
  "/product/ai-agent/simulator/sessions/:sessionRef/end",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.simulatorEndSession
);

aiAgentProductRoutes.post(
  "/product/ai-agent/simulator/messages/:messageRef/review",
  isAuth,
  requireAiAgentProductView,
  AiAgentProductController.simulatorReviewMessage
);

export default aiAgentProductRoutes;
