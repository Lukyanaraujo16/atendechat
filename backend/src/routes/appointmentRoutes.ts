import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import * as AppointmentController from "../controllers/AppointmentController";

const routes = express.Router();

routes.get(
  "/appointments",
  isAuth,
  requireAnyPlanFeature("agenda.calendar"),
  AppointmentController.index
);
routes.get(
  "/appointments/:id",
  isAuth,
  requireAnyPlanFeature("agenda.calendar"),
  AppointmentController.show
);
routes.post(
  "/appointments",
  isAuth,
  requireAnyPlanFeature("agenda.calendar"),
  AppointmentController.store
);
routes.put(
  "/appointments/:id",
  isAuth,
  requireAnyPlanFeature("agenda.calendar"),
  AppointmentController.update
);
routes.delete(
  "/appointments/:id",
  isAuth,
  requireAnyPlanFeature("agenda.calendar"),
  AppointmentController.remove
);
routes.put(
  "/appointments/:id/respond",
  isAuth,
  requireAnyPlanFeature("agenda.calendar"),
  AppointmentController.respond
);

export default routes;
