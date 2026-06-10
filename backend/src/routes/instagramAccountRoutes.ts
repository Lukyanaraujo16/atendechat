import express from "express";
import isAuth from "../middleware/isAuth";
import requireCompanyNotDelinquent from "../middleware/requireCompanyNotDelinquent";

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

instagramAccountRoutes.delete(
  "/instagram-accounts/:id",
  isAuth,
  InstagramAccountController.remove
);

export default instagramAccountRoutes;
