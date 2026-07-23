import { createHash } from "crypto";

const seen = new Map<string, { at: string; status: string }>();

export function buildMcpIdempotencyKey(input: {
  companyId: number;
  executionId?: string | null;
  actionId?: string | null;
  requestId?: string | null;
  serverId: string;
  toolName: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.companyId,
        input.executionId || "",
        input.actionId || "",
        input.requestId || "",
        input.serverId,
        input.toolName
      ].join(":")
    )
    .digest("hex")
    .slice(0, 24);
}

export function claimMcpIdempotency(
  key: string
): { ok: true } | { ok: false; previousStatus: string } {
  const prev = seen.get(key);
  if (prev && prev.status === "success") {
    return { ok: false, previousStatus: prev.status };
  }
  seen.set(key, { at: new Date().toISOString(), status: "pending" });
  return { ok: true };
}

export function completeMcpIdempotency(key: string, status: string): void {
  seen.set(key, { at: new Date().toISOString(), status });
}

export function __resetMcpIdempotencyForTests(): void {
  seen.clear();
}

export default {
  buildMcpIdempotencyKey,
  claimMcpIdempotency,
  completeMcpIdempotency
};
