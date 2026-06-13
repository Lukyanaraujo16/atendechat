import express from "express";
import isAuth from "../middleware/isAuth";
import requireCompanyNotDelinquent from "../middleware/requireCompanyNotDelinquent";
import requireWhatsappBehaviorManager from "../middleware/requireWhatsappBehaviorManager";

import * as InstagramAccountController from "../controllers/InstagramAccountController";

const instagramAccountRoutes = express.Router();

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
