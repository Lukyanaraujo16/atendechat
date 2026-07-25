import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import { hasPlatformPermission } from "../services/PlatformUserPermissionService";
import { PLATFORM_PERMISSION_KEYS } from "../config/platformPermissionConstants";
import { logger } from "../utils/logger";

function resolveMutationPermission(
  method: string,
  path: string
): string | null {
  const m = method.toUpperCase();
  const p = path.toLowerCase();

  const isReplayPath = p.includes("/replay");
  if (isReplayPath && (m === "GET" || m === "POST")) {
    return PLATFORM_PERMISSION_KEYS.AGENTOS_REPLAY_EXECUTE;
  }

  if (m === "GET" || m === "HEAD" || m === "OPTIONS") {
    return null;
  }

  if (p.includes("/emergency-stop") || p.includes("/hydrate")) {
    return PLATFORM_PERMISSION_KEYS.AGENTOS_PRODUCTION_MANAGE;
  }

  if (
    p.includes("/rollout") ||
    p.includes("/live-rollout") ||
    p.includes("/live/") ||
    p.includes("/kill-switch")
  ) {
    return PLATFORM_PERMISSION_KEYS.AGENTOS_ROLLOUT_MANAGE;
  }

  if (
    p.includes("/incidents/") &&
    (p.includes("/acknowledge") || p.includes("/resolve"))
  ) {
    return PLATFORM_PERMISSION_KEYS.AGENTOS_INCIDENTS_MANAGE;
  }

  return PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_MANAGE;
}

/**
 * Após console.view: mutações (e GET de replay) exigem chave específica.
 * Não substitui o gate de entrada; apenas eleva privilégio de escrita.
 */
export default function requireAgentOsMutationGate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const fullPath = `${req.baseUrl || ""}${req.path || ""}`;
  const permission = resolveMutationPermission(req.method, fullPath);

  if (!permission) {
    next();
    return;
  }

  if (!req.user?.id) {
    next(new AppError("ERR_SESSION_EXPIRED", 401));
    return;
  }

  const userId = Number(req.user.id);
  const started = Date.now();

  hasPlatformPermission(userId, permission)
    .then(allowed => {
      if (!allowed) {
        next(
          new AppError(
            "ERR_PLATFORM_PERMISSION_DENIED",
            403,
            "Permissão de plataforma insuficiente."
          )
        );
        return;
      }

      res.on("finish", () => {
        try {
          logger.info(
            {
              event: "agentos.technical_write",
              internalUserId: req.user?.id ?? null,
              permissionKey: permission,
              companyContextId: req.user?.companyId ?? null,
              route: `${req.method} ${fullPath}`,
              action: permission,
              targetId: req.params?.id != null ? String(req.params.id) : null,
              statusCode: res.statusCode,
              result: res.statusCode < 400 ? "ok" : "error",
              durationMs: Date.now() - started,
              supportMode: req.user?.supportMode === true
            },
            "agentos.technical_write"
          );
        } catch {
          /* ignore */
        }
      });

      next();
    })
    .catch(err => next(err));
}
