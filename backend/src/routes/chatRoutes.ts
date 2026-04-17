import express from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";

import * as ChatController from "../controllers/ChatController";

const routes = express.Router();

routes.get("/chats", isAuth, requireEffectiveModule("useInternalChat"), ChatController.index);

routes.get("/chats/:id", isAuth, requireEffectiveModule("useInternalChat"), ChatController.show);

routes.get("/chats/:id/messages", isAuth, requireEffectiveModule("useInternalChat"), ChatController.messages);

routes.post("/chats/:id/messages", isAuth, requireEffectiveModule("useInternalChat"), ChatController.saveMessage);

routes.post("/chats/:id/read", isAuth, requireEffectiveModule("useInternalChat"), ChatController.checkAsRead);

routes.post("/chats", isAuth, requireEffectiveModule("useInternalChat"), ChatController.store);

routes.put("/chats/:id", isAuth, requireEffectiveModule("useInternalChat"), ChatController.update);

routes.delete("/chats/:id", isAuth, requireEffectiveModule("useInternalChat"), ChatController.remove);

export default routes;
