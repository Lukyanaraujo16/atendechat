import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import requireContactLabelEditor from "../middleware/requireContactLabelEditor";
import requireContactLabelAdmin from "../middleware/requireContactLabelAdmin";

import * as ContactLabelController from "../controllers/ContactLabelController";

const contactLabelRoutes = express.Router();

// Escopado aos prefixos servidos por este router (/contact-labels e
// /contacts/:contactId/labels) para não vazar o gate para routers posteriores.
contactLabelRoutes.use(
  "/contact-labels",
  isAuth,
  requireAnyPlanFeature("attendance.inbox")
);
contactLabelRoutes.use(
  "/contacts",
  isAuth,
  requireAnyPlanFeature("attendance.inbox")
);

contactLabelRoutes.get(
  "/contact-labels/stats",
  requireContactLabelEditor,
  ContactLabelController.stats
);

contactLabelRoutes.get(
  "/contact-labels/manage",
  requireContactLabelEditor,
  ContactLabelController.manage
);

contactLabelRoutes.get(
  "/contact-labels/:labelId/usage",
  requireContactLabelEditor,
  ContactLabelController.usage
);

contactLabelRoutes.get(
  "/contact-labels",
  ContactLabelController.index
);

contactLabelRoutes.post(
  "/contact-labels",
  requireContactLabelEditor,
  ContactLabelController.store
);

contactLabelRoutes.put(
  "/contact-labels/:labelId",
  requireContactLabelEditor,
  ContactLabelController.update
);

contactLabelRoutes.delete(
  "/contact-labels/:labelId",
  requireContactLabelAdmin,
  ContactLabelController.remove
);

contactLabelRoutes.get(
  "/contacts/:contactId/labels",
  ContactLabelController.contactLabels
);

contactLabelRoutes.put(
  "/contacts/:contactId/labels",
  ContactLabelController.setContactLabels
);

export default contactLabelRoutes;
