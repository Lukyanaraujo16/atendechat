import {
  redisGet,
  redisSet
} from "../../../../libs/cache";
import {
  CircuitState,
  DEFAULT_LIVE_HARDENING_CONFIG
} from "../../../../config/automationLiveHardeningConstants";
import { logger } from "../../../../utils/logger";

type BreakerRecord = {
  state: CircuitState;
  failures: number;
  openUntil: number;
  halfOpenProbes: number;
};

const mem = new Map<string, BreakerRecord>();

function keyOf(scope: string, id: string): string {
  return `automation:live:cb:${scope}:${id}`;
}

function empty(): BreakerRecord {
  return {
    state: "Closed",
    failures: 0,
    openUntil: 0,
    halfOpenProbes: 0
  };
}

async function load(key: string): Promise<BreakerRecord> {
  try {
    const raw = await redisGet(key);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return mem.get(key) || empty();
}

async function save(key: string, rec: BreakerRecord, ttlSec: number): Promise<void> {
  mem.set(key, rec);
  try {
    await redisSet(key, JSON.stringify(rec), ttlSec);
  } catch (err) {
    logger.debug({ err, key }, "[LiveHardening] cb_redis_fail");
  }
}

function cfg() {
  return DEFAULT_LIVE_HARDENING_CONFIG.circuitBreaker;
}

/**
 * Circuit breaker distribuído (Redis + fallback memória).
 * Estados: Closed | Open | HalfOpen
 */
export async function getCircuitState(input: {
  scope: "company" | "provider" | "tool" | "agent" | "connection";
  id: string;
}): Promise<{ state: CircuitState; openUntil: number; failures: number }> {
  const key = keyOf(input.scope, input.id);
  const rec = await load(key);
  const now = Date.now();
  if (rec.state === "Open" && rec.openUntil <= now) {
    rec.state = "HalfOpen";
    rec.halfOpenProbes = 0;
    await save(key, rec, Math.ceil(cfg().openTtlMs / 1000) * 2);
  }
  return {
    state: rec.state,
    openUntil: rec.openUntil,
    failures: rec.failures
  };
}

export async function isCircuitBlocking(input: {
  scope: "company" | "provider" | "tool" | "agent" | "connection";
  id: string;
}): Promise<boolean> {
  const st = await getCircuitState(input);
  return st.state === "Open";
}

export async function recordCircuitFailure(input: {
  scope: "company" | "provider" | "tool" | "agent" | "connection";
  id: string;
}): Promise<{ state: CircuitState; tripped: boolean }> {
  const key = keyOf(input.scope, input.id);
  const rec = await load(key);
  const c = cfg();
  const now = Date.now();

  if (rec.state === "Open" && rec.openUntil > now) {
    return { state: "Open", tripped: false };
  }

  rec.failures += 1;
  let tripped = false;

  if (rec.state === "HalfOpen") {
    rec.state = "Open";
    rec.openUntil = now + c.openTtlMs;
    tripped = true;
  } else if (rec.failures >= c.failureThreshold) {
    rec.state = "Open";
    rec.openUntil = now + c.openTtlMs;
    tripped = true;
  }

  await save(key, rec, Math.ceil(c.openTtlMs / 1000) * 3);
  return { state: rec.state, tripped };
}

export async function recordCircuitSuccess(input: {
  scope: "company" | "provider" | "tool" | "agent" | "connection";
  id: string;
}): Promise<{ state: CircuitState }> {
  const key = keyOf(input.scope, input.id);
  const rec = await load(key);
  const c = cfg();

  if (rec.state === "HalfOpen") {
    rec.halfOpenProbes += 1;
    if (rec.halfOpenProbes >= c.halfOpenMaxProbes) {
      rec.state = "Closed";
      rec.failures = 0;
      rec.openUntil = 0;
      rec.halfOpenProbes = 0;
    }
  } else if (rec.state === "Closed") {
    rec.failures = Math.max(0, rec.failures - 1);
  }

  await save(key, rec, Math.ceil(c.openTtlMs / 1000) * 3);
  return { state: rec.state };
}

export function __resetDistributedCircuitForTests(): void {
  mem.clear();
}

export default {
  getCircuitState,
  isCircuitBlocking,
  recordCircuitFailure,
  recordCircuitSuccess
};
