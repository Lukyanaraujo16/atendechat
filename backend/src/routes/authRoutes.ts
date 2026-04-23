import { Router } from "express";
import * as SessionController from "../controllers/SessionController";
import * as UserController from "../controllers/UserController";
import * as PasswordResetController from "../controllers/PasswordResetController";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import envTokenAuth from "../middleware/envTokenAuth";

const authRoutes = Router();

authRoutes.post("/signup", envTokenAuth, UserController.store);
authRoutes.post("/forgot-password", PasswordResetController.forgotPassword);
authRoutes.post("/reset-password", PasswordResetController.resetPassword);
authRoutes.post("/login", SessionController.store);
authRoutes.post("/refresh_token", SessionController.update);
authRoutes.delete("/logout", isAuth, SessionController.remove);
authRoutes.get("/me", isAuth, SessionController.me);
authRoutes.post("/support/start", isAuth, isSuper, SessionController.supportStart);
authRoutes.post("/support/stop", isAuth, SessionController.supportStop);

export default authRoutes;
