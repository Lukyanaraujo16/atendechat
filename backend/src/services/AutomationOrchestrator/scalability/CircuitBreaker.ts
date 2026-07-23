import { getAgentOsCacheProvider } from "./providers";
import { getScalabilityConfig } from "./ScalabilityConfig";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

type CircuitRecord = {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  openedAt: number | null;
  nextProbeAt: number | null;
  lastErrorCode: string | null;
};

function key(scope: string) {
  return `cb:${scope}`;
}

async function load(scope: string): Promise<CircuitRecord> {
  const raw = await getAgentOsCacheProvider().get(key(scope));
  if (!raw) {
    return {
      state: "CLOSED",
      failureCount: 0,
      successCount: 0,
      openedAt: null,
      nextProbeAt: null,
      lastErrorCode: null
    };
  }
  try {
    return JSON.parse(raw) as CircuitRecord;
  } catch {
    return {
      state: "CLOSED",
      failureCount: 0,
      successCount: 0,
      openedAt: null,
      nextProbeAt: null,
      lastErrorCode: null
    };
  }
}

async function save(scope: string, rec: CircuitRecord): Promise<void> {
  await getAgentOsCacheProvider().set(
    key(scope),
    JSON.stringify(rec),
    getScalabilityConfig().circuitBreakerOpenMs * 2
  );
}

export async function circuitAllow(scope: string): Promise<boolean> {
  const rec = await load(scope);
  const t = Date.now();
  if (rec.state === "OPEN") {
    if (rec.nextProbeAt && t >= rec.nextProbeAt) {
      rec.state = "HALF_OPEN";
      await save(scope, rec);
      return true;
    }
    return false;
  }
  return true;
}

export async function circuitSuccess(scope: string): Promise<void> {
  const rec = await load(scope);
  rec.successCount += 1;
  rec.failureCount = 0;
  rec.state = "CLOSED";
  rec.openedAt = null;
  rec.nextProbeAt = null;
  await save(scope, rec);
}

export async function circuitFailure(
  scope: string,
  errorCode?: string
): Promise<void> {
  const cfg = getScalabilityConfig();
  const rec = await load(scope);
  rec.failureCount += 1;
  rec.lastErrorCode = errorCode || "ERR";
  if (
    rec.state === "HALF_OPEN" ||
    rec.failureCount >= cfg.circuitBreakerFailureThreshold
  ) {
    rec.state = "OPEN";
    rec.openedAt = Date.now();
    rec.nextProbeAt = Date.now() + cfg.circuitBreakerOpenMs;
  }
  await save(scope, rec);
}

export async function getCircuitState(scope: string): Promise<CircuitRecord> {
  return load(scope);
}
