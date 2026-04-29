import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import * as UserRatingController from "../controllers/UserRatingController";

const routes = express.Router();

routes.get(
  "/user-ratings",
  isAuth,
  requireAnyPlanFeature("team.ratings"),
  UserRatingController.index
);
routes.get(
  "/user-ratings/summary",
  isAuth,
  requireAnyPlanFeature("team.ratings"),
  UserRatingController.summary
);

export default routes;
