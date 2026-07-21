import { createHash } from "crypto";
import { del, setNx } from "../../../libs/cache";
import { logger } from "../../../utils/logger";
import { ToolIdempotencyPolicy } from "./contracts/ToolContract";
import { ToolExecutionContext } from "./ToolExecutionContext";

export function buildToolIdempotencyKey(input: {
  policy: ToolIdempotencyPolicy;
  companyId: number;
  toolId: string;
  toolVersion: string;
  ctx: ToolExecutionContext;
  toolInput?: Record<string, unknown>;
}): string | null {
  const { policy, companyId, toolId, toolVersion, ctx, toolInput } = input;
  if (!policy || policy.type === "none") return null;

  const parts: string[] = [
    `c:${companyId}`,
    `t:${toolId}`,
    `v:${toolVersion}`
  ];

  switch (policy.type) {
    case "request":
      parts.push(`r:${ctx.requestId || "missing"}`);
      break;
    case "message":
      parts.push(`m:${ctx.messageId || "missing"}`);
      break;
    case "execution":
      parts.push(`e:${ctx.automationExecutionId || "missing"}`);
      break;
    case "custom": {
      const field = policy.customKeyField || "customResourceId";
      const fromInput = toolInput?.[field];
      const fromMeta = ctx.metadata?.[field];
      const value = fromInput ?? fromMeta ?? "missing";
      parts.push(`x:${String(value)}`);
      break;
    }
    default:
      return null;
  }

  const raw = parts.join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

export async function acquireToolLock(input: {
  companyId: number;
  toolId: string;
  idempotencyKey: string;
  ttlSeconds?: number;
}): Promise<{ acquired: boolean; key: string; redisUnavailable: boolean }> {
  const key = `automation:tool:lock:${input.companyId}:${input.toolId}:${input.idempotencyKey}`;
  const ttl = Math.max(15, input.ttlSeconds ?? 60);
  try {
    const acquired = await setNx(key, String(Date.now()), ttl);
    return { acquired, key, redisUnavailable: false };
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        toolId: input.toolId
      },
      "[AutomationTools] lock Redis indisponível — fail-closed para write"
    );
    // Fail-closed para idempotência de escrita: sem Redis não adquire.
    return { acquired: false, key, redisUnavailable: true };
  }
}

export async function releaseToolLock(key: string): Promise<void> {
  try {
    await del(key);
  } catch {
    // TTL expira
  }
}
