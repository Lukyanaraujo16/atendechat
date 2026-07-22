import {
  redisExpire,
  redisZAdd,
  redisZCard,
  redisZRemRangeByScore
} from "../../../../libs/cache";
import { DEFAULT_LIVE_HARDENING_CONFIG } from "../../../../config/automationLiveHardeningConstants";
import { logger } from "../../../../utils/logger";

const mem = new Map<string, Array<{ at: number; value: number }>>();

function key(companyId: number, metric: string): string {
  return `automation:live:sw:${companyId}:${metric}`;
}

/**
 * Sample Window Engine — janela deslizante para taxas (fallback/hallucination/etc).
 */
export async function pushSample(input: {
  companyId: number;
  metric: string;
  value?: number;
}): Promise<void> {
  const cfg = DEFAULT_LIVE_HARDENING_CONFIG.sampleWindow;
  const now = Date.now();
  const k = key(input.companyId, input.metric);
  const value = input.value ?? 1;

  const local = mem.get(k) || [];
  local.push({ at: now, value });
  while (local.length && local[0].at < now - cfg.windowMs) local.shift();
  while (local.length > cfg.maxSamples) local.shift();
  mem.set(k, local);

  try {
    await redisZAdd(k, now, `${now}:${value}:${Math.random().toString(36).slice(2, 6)}`);
    await redisZRemRangeByScore(k, 0, now - cfg.windowMs);
    const card = await redisZCard(k);
    if (card > cfg.maxSamples) {
      // trim oldest roughly
      await redisZRemRangeByScore(k, 0, now - cfg.windowMs);
    }
    await redisExpire(k, Math.ceil(cfg.windowMs / 1000) * 2);
  } catch (err) {
    logger.debug({ err }, "[LiveHardening] sample_window_redis_fail");
  }
}

export async function getSampleWindowStats(input: {
  companyId: number;
  metric: string;
}): Promise<{ count: number; sum: number; rate: number }> {
  const cfg = DEFAULT_LIVE_HARDENING_CONFIG.sampleWindow;
  const now = Date.now();
  const k = key(input.companyId, input.metric);
  const local = (mem.get(k) || []).filter(x => x.at >= now - cfg.windowMs);
  const count = local.length;
  const sum = local.reduce((a, b) => a + b.value, 0);
  return {
    count,
    sum,
    rate: count ? sum / count : 0
  };
}

export function __resetSampleWindowForTests(): void {
  mem.clear();
}

export default { pushSample, getSampleWindowStats };
