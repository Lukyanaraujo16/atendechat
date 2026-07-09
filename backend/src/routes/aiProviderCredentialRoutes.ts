import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import * as AiProviderCredentialController from "../controllers/AiProviderCredentialController";

const aiProviderCredentialRoutes = Router();

aiProviderCredentialRoutes.get(
  "/ai-provider-credentials",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiProviderCredentialController.index
);

aiProviderCredentialRoutes.get(
  "/ai-provider-credentials/:id",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiProviderCredentialController.show
);

aiProviderCredentialRoutes.post(
  "/ai-provider-credentials",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiProviderCredentialController.store
);

aiProviderCredentialRoutes.put(
  "/ai-provider-credentials/:id",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiProviderCredentialController.update
);

aiProviderCredentialRoutes.delete(
  "/ai-provider-credentials/:id",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiProviderCredentialController.remove
);

aiProviderCredentialRoutes.post(
  "/ai-provider-credentials/:id/test",
  isAuth,
  requireEffectiveModule("automation.ai_agent"),
  AiProviderCredentialController.test
);

export default aiProviderCredentialRoutes;
