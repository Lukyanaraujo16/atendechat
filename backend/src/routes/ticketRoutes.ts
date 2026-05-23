import express from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";

import * as TicketController from "../controllers/TicketController";
import * as FlowExecutionLogController from "../controllers/FlowExecutionLogController";
import openTicketContextMiddleware from "../middleware/openTicketContext";

const ticketRoutes = express.Router();

ticketRoutes.get(
  "/ticket/kanban",
  isAuth,
  requireAnyPlanFeature("attendance.kanban"),
  requireEffectiveModule("useKanban"),
  TicketController.kanban
);

ticketRoutes.use(isAuth);
ticketRoutes.use(requireAnyPlanFeature("attendance.inbox"));

ticketRoutes.get("/tickets", TicketController.index);
ticketRoutes.get("/tickets/pinned", TicketController.listPinned);
ticketRoutes.get("/tickets/without-connection", TicketController.listWithoutConnection);
ticketRoutes.post("/tickets/bulk-assign-connection", TicketController.bulkAssignConnection);

ticketRoutes.post("/tickets/:ticketId/pin", TicketController.pin);
ticketRoutes.delete("/tickets/:ticketId/pin", TicketController.unpin);
ticketRoutes.post("/tickets/:ticketId/active-view", TicketController.registerActiveView);

ticketRoutes.get("/tickets/:ticketId", TicketController.show);

ticketRoutes.get(
  "/tickets/:ticketId/flow-execution-logs",
  FlowExecutionLogController.indexByTicket
);

ticketRoutes.get(
  "/tickets/u/:uuid",
  openTicketContextMiddleware,
  TicketController.showFromUUID
);

ticketRoutes.post("/tickets", TicketController.store);

ticketRoutes.put("/tickets/:ticketId/reassign-whatsapp", TicketController.reassignWhatsapp);

ticketRoutes.put("/tickets/:ticketId", TicketController.update);

ticketRoutes.delete("/tickets/batch", TicketController.removeBatch);

ticketRoutes.delete("/tickets/:ticketId", TicketController.remove);

export default ticketRoutes;
