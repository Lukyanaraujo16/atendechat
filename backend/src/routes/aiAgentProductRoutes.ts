import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireAiAgentProductView from "../middleware/requireAiAgentProductView";
import logAiAgentProductSupportWrite from "../middleware/logAiAgentProductSupportWrite";
import * as AiAgentProductController from "../controllers/AiAgentProductController";

/**
 * Product API — Agente de IA (Fases 2.0–2.11).
 * isAuth + (admin tenant | Super Admin em supportMode).
 * Sem permissões AgentOS. companyId só do JWT.
 * Multiagente: agentRef em params/query/body; listagem em /agents.
 */
const aiAgentProductRoutes = Router();

const productView = [isAuth, requireAiAgentProductView] as const;

aiAgentProductRoutes.get(
  "/product/ai-agent/agents",
  ...productView,
  AiAgentProductController.listAgents
);

aiAgentProductRoutes.get(
  "/product/ai-agent/agents/:agentRef/summary",
  ...productView,
  AiAgentProductController.summary
);

aiAgentProductRoutes.get(
  "/product/ai-agent/agents/:agentRef/readiness",
  ...productView,
  AiAgentProductController.readiness
);

aiAgentProductRoutes.get(
  "/product/ai-agent/agents/:agentRef/configuration",
  ...productView,
  AiAgentProductController.getConfiguration
);

aiAgentProductRoutes.put(
  "/product/ai-agent/agents/:agentRef/configuration",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.configuration.update"),
  AiAgentProductController.updateConfiguration
);

aiAgentProductRoutes.put(
  "/product/ai-agent/agents/:agentRef/configuration/connections",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.connections.update"),
  AiAgentProductController.updateConnections
);

aiAgentProductRoutes.get(
  "/product/ai-agent/agents/:agentRef/knowledge",
  ...productView,
  AiAgentProductController.listKnowledge
);

aiAgentProductRoutes.put(
  "/product/ai-agent/agents/:agentRef/knowledge",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.knowledge.sync"),
  AiAgentProductController.syncKnowledge
);

aiAgentProductRoutes.get(
  "/product/ai-agent/summary",
  ...productView,
  AiAgentProductController.summary
);

aiAgentProductRoutes.get(
  "/product/ai-agent/readiness",
  ...productView,
  AiAgentProductController.readiness
);

aiAgentProductRoutes.post(
  "/product/ai-agent/agents/:agentRef/commands",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.command"),
  AiAgentProductController.command
);

aiAgentProductRoutes.post(
  "/product/ai-agent/commands",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.command"),
  AiAgentProductController.command
);

aiAgentProductRoutes.get(
  "/product/ai-agent/configuration",
  ...productView,
  AiAgentProductController.getConfiguration
);

aiAgentProductRoutes.post(
  "/product/ai-agent/configuration",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.configuration.create"),
  AiAgentProductController.createConfiguration
);

aiAgentProductRoutes.put(
  "/product/ai-agent/configuration",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.configuration.update"),
  AiAgentProductController.updateConfiguration
);

aiAgentProductRoutes.get(
  "/product/ai-agent/configuration/options",
  ...productView,
  AiAgentProductController.getConfigurationOptions
);

aiAgentProductRoutes.post(
  "/product/ai-agent/configuration/preview",
  ...productView,
  AiAgentProductController.previewConfiguration
);

aiAgentProductRoutes.put(
  "/product/ai-agent/configuration/connections",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.connections.update"),
  AiAgentProductController.updateConnections
);

/** Product Credentials (Fase 2.7) — antes de rotas :param conflitantes. Sem DELETE. */
aiAgentProductRoutes.get(
  "/product/ai-agent/credentials",
  ...productView,
  AiAgentProductController.listCredentials
);

aiAgentProductRoutes.post(
  "/product/ai-agent/credentials",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.credential.create"),
  AiAgentProductController.createCredential
);

aiAgentProductRoutes.get(
  "/product/ai-agent/credentials/:credentialRef",
  ...productView,
  AiAgentProductController.getCredential
);

aiAgentProductRoutes.put(
  "/product/ai-agent/credentials/:credentialRef",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.credential.update"),
  AiAgentProductController.updateCredential
);

aiAgentProductRoutes.post(
  "/product/ai-agent/credentials/:credentialRef/test",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.credential.test"),
  AiAgentProductController.testCredential
);

aiAgentProductRoutes.post(
  "/product/ai-agent/credentials/:credentialRef/enable",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.credential.enable"),
  AiAgentProductController.enableCredential
);

aiAgentProductRoutes.post(
  "/product/ai-agent/credentials/:credentialRef/disable",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.credential.disable"),
  AiAgentProductController.disableCredential
);

aiAgentProductRoutes.get(
  "/product/ai-agent/simulator",
  ...productView,
  AiAgentProductController.simulatorBootstrap
);

aiAgentProductRoutes.post(
  "/product/ai-agent/simulator/sessions",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.simulator.session.create"),
  AiAgentProductController.simulatorCreateSession
);

aiAgentProductRoutes.get(
  "/product/ai-agent/simulator/sessions",
  ...productView,
  AiAgentProductController.simulatorListSessions
);

aiAgentProductRoutes.get(
  "/product/ai-agent/simulator/sessions/:sessionRef",
  ...productView,
  AiAgentProductController.simulatorGetSession
);

aiAgentProductRoutes.post(
  "/product/ai-agent/simulator/sessions/:sessionRef/messages",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.simulator.message"),
  AiAgentProductController.simulatorSendMessage
);

aiAgentProductRoutes.post(
  "/product/ai-agent/simulator/sessions/:sessionRef/end",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.simulator.session.end"),
  AiAgentProductController.simulatorEndSession
);

aiAgentProductRoutes.post(
  "/product/ai-agent/simulator/messages/:messageRef/review",
  ...productView,
  logAiAgentProductSupportWrite("ai_agent.product.simulator.review"),
  AiAgentProductController.simulatorReviewMessage
);

export default aiAgentProductRoutes;
