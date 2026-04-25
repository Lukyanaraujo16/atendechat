import express from "express";
import isAuth from "../middleware/isAuth";
import * as AppointmentController from "../controllers/AppointmentController";

const routes = express.Router();

routes.get("/appointments", isAuth, AppointmentController.index);
routes.get("/appointments/:id", isAuth, AppointmentController.show);
routes.post("/appointments", isAuth, AppointmentController.store);
routes.put("/appointments/:id", isAuth, AppointmentController.update);
routes.delete("/appointments/:id", isAuth, AppointmentController.remove);
routes.put("/appointments/:id/respond", isAuth, AppointmentController.respond);

export default routes;
