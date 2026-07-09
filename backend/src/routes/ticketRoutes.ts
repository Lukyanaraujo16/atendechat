import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import noStoreCache from "../middleware/noStoreCache";

import * as TicketController from "../controllers/TicketController";
import * as FlowExecutionLogController from "../controllers/FlowExecutionLogController";
import openTicketContextMiddleware from "../middleware/openTicketContext";

const ticketRoutes = express.Router();

ticketRoutes.get(
  "/ticket/kanban",
  isAuth,
  requireAnyPlanFeature("attendance.kanban"),
  TicketController.kanban
);

/** Atualização de ticket: inbox OU kanban (antes do gate só-inbox). */
ticketRoutes.put(
  "/tickets/:ticketId",
  isAuth,
  requireAnyPlanFeature("attendance.inbox", "attendance.kanban"),
  TicketController.update
);

ticketRoutes.use(isAuth);
ticketRoutes.use(requireAnyPlanFeature("attendance.inbox"));

ticketRoutes.get("/tickets", noStoreCache, TicketController.index);
ticketRoutes.get("/tickets/pinned", noStoreCache, TicketController.listPinned);
ticketRoutes.get(
  "/tickets/without-connection",
  noStoreCache,
  TicketController.listWithoutConnection
);
ticketRoutes.post("/tickets/bulk-assign-connection", TicketController.bulkAssignConnection);

ticketRoutes.post("/tickets/:ticketId/pin", TicketController.pin);
ticketRoutes.delete("/tickets/:ticketId/pin", TicketController.unpin);
ticketRoutes.post("/tickets/:ticketId/active-view", TicketController.registerActiveView);

ticketRoutes.post(
  "/tickets/:ticketId/ai-agent/pause",
  requireEffectiveModule("automation.ai_agent"),
  TicketController.pauseAiAgent
);
ticketRoutes.post(
  "/tickets/:ticketId/ai-agent/resume",
  requireEffectiveModule("automation.ai_agent"),
  TicketController.resumeAiAgent
);

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

ticketRoutes.delete("/tickets/batch", TicketController.removeBatch);

ticketRoutes.delete("/tickets/:ticketId", TicketController.remove);

export default ticketRoutes;
