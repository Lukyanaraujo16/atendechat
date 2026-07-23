import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { AGENTOS_RATE_LIMITS } from "../config/automationAgentOsSecurityConstants";
import { getAgentOsRateLimitProvider } from "../services/AutomationOrchestrator/scalability/providers";
import { recordDistributedMetric } from "../services/AutomationOrchestrator/scalability/DistributedMetrics";

type Bucket = { count: number; resetAt: number };

/** Fallback local apenas quando provider falha em modo memory tests. */
const buckets = new Map<string, Bucket>();

function keyFor(req: Request, scope: string): string {
  const companyId = req.user?.companyId ?? "anon";
  const userId = req.user?.id ?? "anon";
  return `${scope}:${companyId}:${userId}`;
}

export function agentOsRateLimit(
  scope: keyof typeof AGENTOS_RATE_LIMITS | "adminApi" = "adminApi"
) {
  const lim = AGENTOS_RATE_LIMITS[scope] || AGENTOS_RATE_LIMITS.adminApi;
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const provider = getAgentOsRateLimitProvider();
      const result = await provider.take({
        scope: String(scope),
        key: keyFor(req, String(scope)),
        windowMs: lim.windowMs,
        max: lim.max
      });
      if (!result.allowed) {
        const companyId = Number(req.user?.companyId || 0);
        if (companyId > 0) {
          void recordDistributedMetric({
            companyId,
            component: "api",
            operation: "rate_limit",
            status: "failure"
          });
        }
        return next(
          new AppError("ERR_RATE_LIMIT", 429, "Rate limit AgentOS excedido")
        );
      }
      return next();
    } catch {
      // fail-closed for AgentOS
      return next(
        new AppError("ERR_RATE_LIMIT", 429, "Rate limit AgentOS indisponível")
      );
    }
  };
}

/** Limpa buckets locais (testes). */
export function resetAgentOsRateLimitBuckets(): void {
  buckets.clear();
}

export function classifyAgentOsRateScope(
  path: string
): keyof typeof AGENTOS_RATE_LIMITS {
  const p = path.toLowerCase();
  if (p.includes("/replay")) return "replay";
  if (p.includes("/learning")) return "learning";
  if (p.includes("/coordination")) return "coordination";
  if (p.includes("/delegation")) return "delegation";
  if (p.includes("/handoff")) return "handoff";
  if (p.includes("/dashboard") || p.includes("/metrics")) return "dashboardHeavy";
  if (p.includes("/mcp")) return "mcp";
  if (p.includes("/simulate") || p.includes("/simulation") || p.includes("/tester"))
    return "tester";
  return "adminApi";
}

export async function agentOsAutoRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const scope = classifyAgentOsRateScope(req.path || req.originalUrl || "");
  return agentOsRateLimit(scope)(req, res, next);
}
