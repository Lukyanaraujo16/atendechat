import { del, setNx } from "../../../libs/cache";
import { logger } from "../../../utils/logger";

/**
 * Lock distribuído (Redis NX) para geração Shadow/Live.
 * Complementa claim SQL + debounce in-memory em multi-instância.
 * Fail-open se Redis estiver indisponível (não bloqueia atendimento).
 */
export async function acquireAiAgentGenerationLock(input: {
  channel: "shadow" | "live";
  companyId: number;
  logId: number;
  ttlSeconds?: number;
}): Promise<{ acquired: boolean; key: string; redisUnavailable: boolean }> {
  const key = `ai-agent:${input.channel}:gen:${input.companyId}:${input.logId}`;
  const ttl = Math.max(15, input.ttlSeconds ?? 90);
  try {
    const acquired = await setNx(key, String(Date.now()), ttl);
    return { acquired, key, redisUnavailable: false };
  } catch (err) {
    logger.warn(
      `[AiAgent] lock Redis indisponível (${input.channel}): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return { acquired: true, key, redisUnavailable: true };
  }
}

export async function releaseAiAgentGenerationLock(key: string): Promise<void> {
  try {
    await del(key);
  } catch {
    // TTL expira naturalmente
  }
}
