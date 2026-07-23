import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import { AGENTOS_PRODUCTION_PERMISSIONS } from "../config/automationAgentOsProductionConstants";

/**
 * RBAC granular AgentOS — reutiliza profile do projeto.
 * Admin tenant: ações de view/configure/rollout do tenant.
 * Emergency/super-critical: admin OU super (não support implícito).
 * Support mode: somente view*, sem mutate crítico.
 */
const VIEW_PERMS = new Set<string>(
  AGENTOS_PRODUCTION_PERMISSIONS.filter(
    p => p.endsWith(".view") || p.includes(".health.") || p.includes(".metrics.")
  )
);

const CRITICAL_PERMS = new Set<string>([
  "automation.agentos.emergencyStop",
  "automation.agentos.rollout.manage",
  "automation.learning.promote",
  "automation.mcp.executeWrite",
  "automation.tools.executeWrite",
  "automation.agents.activate"
]);

export function requireAgentOsPermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (
      !(AGENTOS_PRODUCTION_PERMISSIONS as readonly string[]).includes(permission)
    ) {
      next(new AppError("ERR_UNKNOWN_PERMISSION", 500));
      return;
    }

    const profile = req.user?.profile;
    const support = req.user?.supportMode === true;
    const isSuper = (req.user as any)?.super === true;
    const explicit: string[] = Array.isArray((req.user as any)?.permissions)
      ? (req.user as any).permissions
      : [];

    if (explicit.includes(permission)) {
      next();
      return;
    }

    if (isSuper && permission.startsWith("automation.agentos.")) {
      next();
      return;
    }

    if (CRITICAL_PERMS.has(permission)) {
      if (profile === "admin" && !support) {
        next();
        return;
      }
      next(new AppError("ERR_NO_PERMISSION", 403));
      return;
    }

    if (VIEW_PERMS.has(permission)) {
      if (profile === "admin" || support || profile === "supervisor") {
        next();
        return;
      }
      next(new AppError("ERR_NO_PERMISSION", 403));
      return;
    }

    // demais mutações: admin tenant (support não bypass)
    if (profile === "admin" && !support) {
      next();
      return;
    }

    next(new AppError("ERR_NO_PERMISSION", 403));
  };
}

export default requireAgentOsPermission;
