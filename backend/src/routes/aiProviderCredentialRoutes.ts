import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import { rejectLegacyAiProviderCredentialCommercialMutation } from "../middleware/rejectLegacyAiAgentCommercialMutation";
import * as AiProviderCredentialController from "../controllers/AiProviderCredentialController";

const aiProviderCredentialRoutes = Router();
const requireAiAgent = requireEffectiveModule("automation.ai_agent");
/** Fase 2.8B.2 — mutações comerciais legadas bloqueadas; GET list permanece (KB). */
const blockCredential = rejectLegacyAiProviderCredentialCommercialMutation();

aiProviderCredentialRoutes.get(
  "/ai-provider-credentials",
  isAuth,
  requireAiAgent,
  AiProviderCredentialController.index
);

aiProviderCredentialRoutes.get(
  "/ai-provider-credentials/:id",
  isAuth,
  requireAiAgent,
  AiProviderCredentialController.show
);

aiProviderCredentialRoutes.post(
  "/ai-provider-credentials",
  isAuth,
  requireAiAgent,
  blockCredential,
  AiProviderCredentialController.store
);

aiProviderCredentialRoutes.put(
  "/ai-provider-credentials/:id",
  isAuth,
  requireAiAgent,
  blockCredential,
  AiProviderCredentialController.update
);

aiProviderCredentialRoutes.delete(
  "/ai-provider-credentials/:id",
  isAuth,
  requireAiAgent,
  blockCredential,
  AiProviderCredentialController.remove
);

aiProviderCredentialRoutes.post(
  "/ai-provider-credentials/:id/test",
  isAuth,
  requireAiAgent,
  blockCredential,
  AiProviderCredentialController.test
);

export default aiProviderCredentialRoutes;
