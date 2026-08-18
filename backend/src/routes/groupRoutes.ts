import express from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import * as GroupController from "../controllers/GroupController";

const groupRoutes = express.Router();
const groupsModule = requireEffectiveModule("useGroups");
const exportParticipantsFeature = requireAnyPlanFeature(
  "team.export_group_participants"
);

groupRoutes.post("/groups/create", isAuth, groupsModule, GroupController.create);
groupRoutes.post("/groups/join", isAuth, groupsModule, GroupController.join);
groupRoutes.post("/groups/leave", isAuth, groupsModule, GroupController.leave);
groupRoutes.post(
  "/groups/open-conversation",
  isAuth,
  groupsModule,
  GroupController.openConversation
);
groupRoutes.get("/groups/inbox", isAuth, groupsModule, GroupController.inbox);
groupRoutes.post(
  "/groups/:whatsappId/participants/preview",
  isAuth,
  groupsModule,
  exportParticipantsFeature,
  GroupController.previewParticipants
);
groupRoutes.post(
  "/groups/:whatsappId/participants/export",
  isAuth,
  groupsModule,
  exportParticipantsFeature,
  GroupController.exportParticipants
);
groupRoutes.post(
  "/groups/:whatsappId/participants/import",
  isAuth,
  groupsModule,
  exportParticipantsFeature,
  GroupController.importParticipants
);
groupRoutes.get("/groups/:whatsappId", isAuth, groupsModule, GroupController.list);

export default groupRoutes;
