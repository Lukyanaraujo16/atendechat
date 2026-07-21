import { ToolRateLimitPolicy } from "./contracts/ToolContract";
import { ToolExecutionContext } from "./ToolExecutionContext";

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

function scopeKey(
  policy: ToolRateLimitPolicy,
  ctx: ToolExecutionContext,
  toolId: string
): string {
  const base = `${ctx.companyId}:${toolId}:${policy.scope}`;
  switch (policy.scope) {
    case "ticket":
      return `${base}:${ctx.ticketId || "none"}`;
    case "contact":
      return `${base}:${ctx.contactId || "none"}`;
    case "execution":
      return `${base}:${ctx.automationExecutionId || "none"}`;
    case "user":
      return `${base}:${ctx.userId || "none"}`;
    case "company":
    default:
      return `${base}`;
  }
}

/**
 * Rate limit in-memory por processo (infraestrutura).
 * Conservador para Tools técnicas; produção futura pode migrar para Redis.
 */
export function checkToolRateLimit(input: {
  policy: ToolRateLimitPolicy;
  ctx: ToolExecutionContext;
  toolId: string;
}): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const { policy, ctx, toolId } = input;
  const key = scopeKey(policy, ctx, toolId);
  const now = Date.now();
  const windowMs = Math.max(1, policy.windowSeconds) * 1000;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter(t => now - t < windowMs);

  if (bucket.timestamps.length >= policy.maxCalls) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - oldest)) / 1000)
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, policy.maxCalls - bucket.timestamps.length),
    retryAfterSeconds: 0
  };
}

export function __resetToolRateLimitForTests(): void {
  buckets.clear();
}
