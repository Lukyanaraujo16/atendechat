import express from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import * as GroupController from "../controllers/GroupController";

const groupRoutes = express.Router();

groupRoutes.post("/groups/create", isAuth,
  requireEffectiveModule("useGroups"), GroupController.create);
groupRoutes.post("/groups/join", isAuth,
  requireEffectiveModule("useGroups"), GroupController.join);
groupRoutes.post("/groups/leave", isAuth,
  requireEffectiveModule("useGroups"), GroupController.leave);
groupRoutes.post("/groups/open-conversation", isAuth,
  requireEffectiveModule("useGroups"), GroupController.openConversation);
groupRoutes.get("/groups/inbox", isAuth,
  requireEffectiveModule("useGroups"), GroupController.inbox);
groupRoutes.get("/groups/:whatsappId", isAuth,
  requireEffectiveModule("useGroups"), GroupController.list);

export default groupRoutes;
