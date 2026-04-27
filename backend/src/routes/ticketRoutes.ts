import express from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";

import * as TicketController from "../controllers/TicketController";
import * as FlowExecutionLogController from "../controllers/FlowExecutionLogController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets", isAuth, TicketController.index);
ticketRoutes.get("/tickets/without-connection", isAuth, TicketController.listWithoutConnection);
ticketRoutes.post("/tickets/bulk-assign-connection", isAuth, TicketController.bulkAssignConnection);

ticketRoutes.post(
  "/tickets/:ticketId/active-view",
  isAuth,
  TicketController.registerActiveView
);

ticketRoutes.get("/tickets/:ticketId", isAuth, TicketController.show);

ticketRoutes.get(
  "/tickets/:ticketId/flow-execution-logs",
  isAuth,
  FlowExecutionLogController.indexByTicket
);

ticketRoutes.get(
  "/ticket/kanban",
  isAuth,
  requireEffectiveModule("useKanban"),
  TicketController.kanban
);

ticketRoutes.get("/tickets/u/:uuid", isAuth, TicketController.showFromUUID);

ticketRoutes.post("/tickets", isAuth, TicketController.store);

ticketRoutes.put(
  "/tickets/:ticketId/reassign-whatsapp",
  isAuth,
  TicketController.reassignWhatsapp
);

ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);

ticketRoutes.delete("/tickets/:ticketId", isAuth, TicketController.remove);

export default ticketRoutes;
