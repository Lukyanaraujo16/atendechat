import express from "express";

import * as InstagramAccountController from "../controllers/InstagramAccountController";
import { logger } from "../utils/logger";

/**
 * Rota OAuth Instagram — deve ficar fora de routers com isAuth global
 * (ex.: contactRoutes.use(isAuth)), pois a Meta redireciona sem Authorization.
 */
const instagramOAuthCallbackRoutes = express.Router();

instagramOAuthCallbackRoutes.get(
  "/instagram/oauth/callback",
  (req, res, next) => {
    logger.info(
      {
        hasCode: typeof req.query.code === "string",
        hasState: typeof req.query.state === "string",
        hasOAuthError: typeof req.query.error === "string"
      },
      "[InstagramOAuth] public_callback_route_hit"
    );
    return InstagramAccountController.oauthCallback(req, res).catch(next);
  }
);

export default instagramOAuthCallbackRoutes;
