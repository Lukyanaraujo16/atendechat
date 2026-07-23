import { getAgentOsCacheProvider } from "./providers";
import { getScalabilityConfig } from "./ScalabilityConfig";
import { percentile } from "../observability/types";

/**
 * Métricas multi-nó via buckets no cache provider (Redis em prod / memory em test).
 * Não usa IDs individuais como labels.
 */
export async function incrMetricBucket(input: {
  companyId: number;
  component: string;
  operation: string;
  status: "success" | "failure";
  latencyMs?: number;
  retries?: number;
  timeouts?: number;
  fallbacks?: number;
  rateLimits?: number;
}): Promise<void> {
  const cfg = getScalabilityConfig();
  const bucket = Math.floor(Date.now() / cfg.metricsBucketSizeMs);
  const base = `m:${input.companyId}:${input.component}:${input.operation}:${bucket}`;
  const cache = getAgentOsCacheProvider();
  const ttl = cfg.metricsBucketSizeMs * 120;

  const bump = async (field: string, by = 1) => {
    const k = `${base}:${field}`;
    const cur = Number((await cache.get(k)) || 0);
    await cache.set(k, String(cur + by), ttl);
  };

  await bump("count");
  await bump(input.status);
  if (input.latencyMs != null) {
    await bump("latencySum", Math.max(0, input.latencyMs));
    await bump("latencyN");
    // histogram coarse buckets
    const lat = Math.max(0, input.latencyMs);
    const h =
      lat < 50
        ? "h50"
        : lat < 100
          ? "h100"
          : lat < 250
            ? "h250"
            : lat < 500
              ? "h500"
              : lat < 1000
                ? "h1000"
                : lat < 2000
                  ? "h2000"
                  : "hSlow";
    await bump(h);
  }
  if (input.retries) await bump("retries", input.retries);
  if (input.timeouts) await bump("timeouts", input.timeouts);
  if (input.fallbacks) await bump("fallbacks", input.fallbacks);
  if (input.rateLimits) await bump("rateLimits", input.rateLimits);
}

export async function readMetricBuckets(input: {
  companyId: number;
  component?: string;
  windows?: number;
}) {
  const cfg = getScalabilityConfig();
  const windows = input.windows || 5;
  const cache = getAgentOsCacheProvider();
  const nowBucket = Math.floor(Date.now() / cfg.metricsBucketSizeMs);
  let count = 0;
  let success = 0;
  let failure = 0;
  let latencySum = 0;
  let latencyN = 0;
  const samples: number[] = [];

  for (let i = 0; i < windows; i += 1) {
    const bucket = nowBucket - i;
    // Without SCAN, approximate via known components when provided
    const component = input.component || "all";
    const base = `m:${input.companyId}:${component}:agg:${bucket}`;
    // Also try operation=* pattern via fixed "all" operation key written by callers using operation "all"
    const keys = ["count", "success", "failure", "latencySum", "latencyN"];
    for (const field of keys) {
      const v = Number((await cache.get(`${base}:${field}`)) || 0);
      if (field === "count") count += v;
      if (field === "success") success += v;
      if (field === "failure") failure += v;
      if (field === "latencySum") latencySum += v;
      if (field === "latencyN") latencyN += v;
    }
  }

  const avg = latencyN ? Math.round(latencySum / latencyN) : 0;
  return {
    count,
    success,
    failure,
    averageLatency: avg,
    p95Latency: percentile(samples.length ? samples : [avg], 95),
    p99Latency: percentile(samples.length ? samples : [avg], 99),
    generatedAt: new Date().toISOString(),
    dataFreshness: "eventual"
  };
}

/** Emite também sob chave agregada `operation=all` para dashboards. */
export async function recordDistributedMetric(input: {
  companyId: number;
  component: string;
  operation: string;
  status: "success" | "failure";
  latencyMs?: number;
}): Promise<void> {
  await incrMetricBucket(input);
  await incrMetricBucket({
    ...input,
    component: input.component,
    operation: "all"
  });
  // Normalize component rollup
  const cfg = getScalabilityConfig();
  const bucket = Math.floor(Date.now() / cfg.metricsBucketSizeMs);
  const base = `m:${input.companyId}:${input.component}:agg:${bucket}`;
  const cache = getAgentOsCacheProvider();
  const ttl = cfg.metricsBucketSizeMs * 120;
  const bump = async (field: string, by = 1) => {
    const k = `${base}:${field}`;
    const cur = Number((await cache.get(k)) || 0);
    await cache.set(k, String(cur + by), ttl);
  };
  await bump("count");
  await bump(input.status);
  if (input.latencyMs != null) {
    await bump("latencySum", Math.max(0, input.latencyMs));
    await bump("latencyN");
  }
}
