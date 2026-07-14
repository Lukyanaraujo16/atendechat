import express from "express";
import isAuth from "../middleware/isAuth";
import requireCompanyNotDelinquent from "../middleware/requireCompanyNotDelinquent";
import requireWhatsappBehaviorManager from "../middleware/requireWhatsappBehaviorManager";
import requireInstagramIntegration from "../middleware/requireInstagramIntegration";

import * as InstagramAccountController from "../controllers/InstagramAccountController";
import * as MetaWebhookController from "../controllers/MetaWebhookController";

const instagramAccountRoutes = express.Router();

// Escopado ao prefixo do próprio router. Sem o path, este middleware rodaria
// para TODAS as rotas montadas depois em routes/index.ts (messages, stickers,
// queue, companies/listPlan, announcements), bloqueando-as com
// ERR_USER_FEATURE_DISABLED para quem não tem a integração do Instagram.
instagramAccountRoutes.use("/instagram-accounts", isAuth, requireInstagramIntegration);

instagramAccountRoutes.get(
  "/instagram-accounts/webhook-info",
  isAuth,
  requireWhatsappBehaviorManager,
  MetaWebhookController.webhookInfo
);

instagramAccountRoutes.get(
  "/instagram-accounts",
  isAuth,
  InstagramAccountController.index
);

instagramAccountRoutes.post(
  "/instagram-accounts",
  isAuth,
  requireCompanyNotDelinquent,
  InstagramAccountController.store
);

instagramAccountRoutes.get(
  "/instagram-accounts/:id/webhook-diagnostics",
  isAuth,
  requireWhatsappBehaviorManager,
  InstagramAccountController.webhookDiagnostics
);

instagramAccountRoutes.post(
  "/instagram-accounts/:id/subscribe-webhook",
  isAuth,
  requireWhatsappBehaviorManager,
  InstagramAccountController.subscribeWebhook
);

instagramAccountRoutes.get(
  "/instagram-accounts/:id",
  isAuth,
  InstagramAccountController.show
);

instagramAccountRoutes.put(
  "/instagram-accounts/:id",
  isAuth,
  InstagramAccountController.update
);

instagramAccountRoutes.post(
  "/instagram-accounts/:id/connect-token",
  isAuth,
  requireWhatsappBehaviorManager,
  InstagramAccountController.connectToken
);

instagramAccountRoutes.post(
  "/instagram-accounts/:id/oauth/start",
  isAuth,
  requireWhatsappBehaviorManager,
  InstagramAccountController.startOAuth
);

instagramAccountRoutes.get(
  "/instagram-accounts/:id/oauth/status",
  isAuth,
  requireWhatsappBehaviorManager,
  InstagramAccountController.oauthStatus
);

instagramAccountRoutes.post(
  "/instagram-accounts/:id/oauth/refresh",
  isAuth,
  requireWhatsappBehaviorManager,
  InstagramAccountController.oauthRefresh
);

instagramAccountRoutes.post(
  "/instagram-accounts/:id/disconnect",
  isAuth,
  requireWhatsappBehaviorManager,
  InstagramAccountController.disconnect
);

instagramAccountRoutes.delete(
  "/instagram-accounts/:id",
  isAuth,
  InstagramAccountController.remove
);

export default instagramAccountRoutes;
