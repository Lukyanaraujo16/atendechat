import express from "express";

import * as InstagramAccountController from "../controllers/InstagramAccountController";
import { normalizeOAuthStateParam } from "../helpers/metaOAuthState";
import { logger } from "../utils/logger";

const readQueryString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
};

/**
 * Rota OAuth Instagram — deve ficar fora de routers com isAuth global
 * (ex.: contactRoutes.use(isAuth)), pois a Meta redireciona sem Authorization.
 */
const instagramOAuthCallbackRoutes = express.Router();

instagramOAuthCallbackRoutes.get(
  "/instagram/oauth/callback",
  (req, res, next) => {
    const rawState = readQueryString(req.query.state);
    const normalizedState = normalizeOAuthStateParam(rawState);

    logger.info(
      {
        hasCode: typeof req.query.code === "string",
        hasState: Boolean(rawState),
        hasOAuthError: typeof req.query.error === "string",
        stateLength: normalizedState.length,
        hasDot: normalizedState.includes("."),
        partsCount: normalizedState
          ? normalizedState.split(".").length
          : 0
      },
      "[InstagramOAuth] public_callback_route_hit"
    );
    return InstagramAccountController.oauthCallback(req, res).catch(next);
  }
);

export default instagramOAuthCallbackRoutes;
