import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  isSystemUpdateJobRunning,
  startSystemUpdateJob
} from "../services/SystemAdmin/SystemUpdateJobService";
import { isSystemUpdateAction, SystemUpdateAction } from "../services/SystemAdmin/SafeCommandRunner";

const ACTION_MAP: Record<string, SystemUpdateAction> = {
  "git-status": "git_status",
  "git-log": "git_log",
  "git-pull": "git_pull",
  "backend-npm-install": "backend_npm_install",
  "backend-build": "backend_build",
  "backend-migrate": "backend_migrate",
  "backend-restart": "backend_restart",
  "frontend-npm-install": "frontend_npm_install",
  "frontend-build": "frontend_build"
};

export const runAction = async (req: Request, res: Response): Promise<void> => {
  const routeAction = String(req.params.action || "");
  const mapped = ACTION_MAP[routeAction];

  if (!mapped || !isSystemUpdateAction(mapped)) {
    throw new AppError("SYSTEM_UPDATE_INVALID_ACTION", 400);
  }

  if (isSystemUpdateJobRunning()) {
    throw new AppError("SYSTEM_UPDATE_JOB_RUNNING", 409);
  }

  const userId = Number(req.user.id);
  void startSystemUpdateJob(mapped, userId).catch(() => {
    // erros já emitidos via socket; evita unhandled rejection
  });

  res.status(202).json({
    accepted: true,
    action: mapped,
    routeAction
  });
};
