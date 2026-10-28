import crypto from "crypto";
import { Op, QueryTypes } from "sequelize";
import EvolutionMetricSample, {
  EvolutionContainerRole,
  EvolutionContainerSample
} from "../../models/EvolutionMetricSample";

/**
 * Monitoramento Evolution — métricas de infraestrutura da VPS Evolution.
 * O coletor (deploy/evolution-metrics-collector) envia amostras a cada ~60s para
 * POST /system/evolution-metrics com token próprio (EVOLUTION_METRICS_INGEST_TOKEN).
 * Nada aqui é estimado: sem amostra, os campos voltam null.
 */

export const EVOLUTION_METRICS_RETENTION_DAYS = 7;
export const EVOLUTION_METRICS_STALE_AFTER_SECONDS = 180;
export const EVOLUTION_METRICS_MAX_BATCH = 500;
const MIN_TOKEN_LENGTH = 32;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

const ROLES: EvolutionContainerRole[] = ["api", "postgres", "redis"];
const CONTAINER_STATES = [
  "created",
  "running",
  "restarting",
  "paused",
  "exited",
  "removing",
  "dead",
  "missing"
];
const HEALTH_STATES = ["healthy", "unhealthy", "starting"];

export const HISTORY_RANGES = {
  "24h": { seconds: 86_400, bucketSeconds: 300 },
  "7d": { seconds: 7 * 86_400, bucketSeconds: 1_800 }
} as const;
export type HistoryRange = keyof typeof HISTORY_RANGES;

// ---------------------------------------------------------------- autenticação

function configuredIngestToken(): string | null {
  const token = String(process.env.EVOLUTION_METRICS_INGEST_TOKEN || "").trim();
  return token.length >= MIN_TOKEN_LENGTH ? token : null;
}

export function isEvolutionMetricsIngestConfigured(): boolean {
  return configuredIngestToken() !== null;
}

/** Compara via SHA-256 + timingSafeEqual (tamanho fixo, sem vazar comprimento). */
export function verifyEvolutionMetricsIngestToken(
  presented: string | null
): "ok" | "not_configured" | "invalid" {
  const expected = configuredIngestToken();
  if (!expected) return "not_configured";
  if (!presented) return "invalid";
  const a = crypto.createHash("sha256").update(presented).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b) ? "ok" : "invalid";
}

// ------------------------------------------------------------------- validação

export class EvolutionMetricsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvolutionMetricsValidationError";
  }
}

type Obj = Record<string, unknown>;

function fail(path: string, rule: string): never {
  throw new EvolutionMetricsValidationError(`${path}: ${rule}`);
}

function obj(value: unknown, path: string): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(path, "object");
  return value as Obj;
}

function num(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    fail(path, "number");
  if (value < min || value > max) fail(path, `range ${min}..${max}`);
  return value;
}

function int(value: unknown, path: string, min: number, max: number): number {
  const n = num(value, path, min, max);
  if (!Number.isSafeInteger(n)) fail(path, "integer");
  return n;
}

function nullable<T>(value: unknown, parse: (v: unknown) => T): T | null {
  return value === null || value === undefined ? null : parse(value);
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "boolean");
  return value;
}

function text(value: unknown, path: string, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) fail(path, "format");
  return value;
}

function isoDate(value: unknown, path: string, nowMs: number): Date {
  if (typeof value !== "string") fail(path, "ISO date");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(path, "ISO date");
  if (date.getTime() > nowMs + MAX_FUTURE_SKEW_MS) fail(path, "future date");
  return date;
}

const SOURCE_RE = /^[A-Za-z0-9._-]{1,64}$/;
const CONTAINER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const IMAGE_RE = /^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,199}$/;
const MAX_BYTES = Number.MAX_SAFE_INTEGER;

function parseContainer(
  value: unknown,
  path: string,
  nowMs: number
): EvolutionContainerSample {
  const c = obj(value, path);
  const role = c.role as EvolutionContainerRole;
  if (!ROLES.includes(role)) fail(`${path}.role`, ROLES.join("|"));
  const state = String(c.state);
  if (!CONTAINER_STATES.includes(state)) fail(`${path}.state`, "docker state");
  const health = nullable(c.health, v => {
    if (!HEALTH_STATES.includes(String(v))) fail(`${path}.health`, "health");
    return String(v);
  });
  return {
    role,
    name: text(c.name, `${path}.name`, CONTAINER_NAME_RE),
    state,
    running: bool(c.running, `${path}.running`),
    health,
    startedAt: nullable(c.startedAt, v =>
      isoDate(v, `${path}.startedAt`, nowMs).toISOString()
    ),
    restartCount: int(c.restartCount, `${path}.restartCount`, 0, 1_000_000),
    oomKilled: bool(c.oomKilled, `${path}.oomKilled`),
    cpuPercent: nullable(c.cpuPercent, v =>
      num(v, `${path}.cpuPercent`, 0, 100)
    ),
    memBytes: nullable(c.memBytes, v =>
      int(v, `${path}.memBytes`, 0, MAX_BYTES)
    ),
    memLimitBytes: nullable(c.memLimitBytes, v =>
      int(v, `${path}.memLimitBytes`, 1, MAX_BYTES)
    ),
    image: nullable(c.image, v => text(v, `${path}.image`, IMAGE_RE))
  };
}

type SampleRow = {
  source: string;
  collectedAt: Date;
  hostCpuPercent: number;
  hostCpuCores: number;
  hostMemTotalBytes: number;
  hostMemUsedBytes: number;
  hostMemAvailableBytes: number;
  hostDiskTotalBytes: number;
  hostDiskUsedBytes: number;
  hostDiskAvailableBytes: number;
  hostLoad1: number;
  hostLoad5: number;
  hostLoad15: number;
  hostBootAt: Date;
  apiCpuPercent: number | null;
  apiMemBytes: number | null;
  containers: EvolutionContainerSample[];
};

function parseSample(value: unknown, path: string, nowMs: number): SampleRow {
  const s = obj(value, path);
  const collectedAt = isoDate(s.collectedAt, `${path}.collectedAt`, nowMs);
  if (
    collectedAt.getTime() <
    nowMs - EVOLUTION_METRICS_RETENTION_DAYS * DAY_MS
  ) {
    fail(`${path}.collectedAt`, "older than retention");
  }
  const h = obj(s.host, `${path}.host`);
  const memTotal = int(
    h.memTotalBytes,
    `${path}.host.memTotalBytes`,
    1,
    MAX_BYTES
  );
  const diskTotal = int(
    h.diskTotalBytes,
    `${path}.host.diskTotalBytes`,
    1,
    MAX_BYTES
  );
  const raw = s.containers ?? [];
  if (!Array.isArray(raw) || raw.length > ROLES.length) {
    fail(`${path}.containers`, `array (max ${ROLES.length})`);
  }
  const containers = raw.map((c, i) =>
    parseContainer(c, `${path}.containers[${i}]`, nowMs)
  );
  if (new Set(containers.map(c => c.role)).size !== containers.length) {
    fail(`${path}.containers`, "duplicated role");
  }
  const api = containers.find(c => c.role === "api");
  return {
    source: text(s.source, `${path}.source`, SOURCE_RE),
    collectedAt,
    hostCpuPercent: num(h.cpuPercent, `${path}.host.cpuPercent`, 0, 100),
    hostCpuCores: int(h.cpuCores, `${path}.host.cpuCores`, 1, 4096),
    hostMemTotalBytes: memTotal,
    hostMemUsedBytes: int(
      h.memUsedBytes,
      `${path}.host.memUsedBytes`,
      0,
      memTotal
    ),
    hostMemAvailableBytes: int(
      h.memAvailableBytes,
      `${path}.host.memAvailableBytes`,
      0,
      memTotal
    ),
    hostDiskTotalBytes: diskTotal,
    hostDiskUsedBytes: int(
      h.diskUsedBytes,
      `${path}.host.diskUsedBytes`,
      0,
      diskTotal
    ),
    hostDiskAvailableBytes: int(
      h.diskAvailableBytes,
      `${path}.host.diskAvailableBytes`,
      0,
      diskTotal
    ),
    hostLoad1: num(h.load1, `${path}.host.load1`, 0, 100_000),
    hostLoad5: num(h.load5, `${path}.host.load5`, 0, 100_000),
    hostLoad15: num(h.load15, `${path}.host.load15`, 0, 100_000),
    hostBootAt: isoDate(h.bootAt, `${path}.host.bootAt`, nowMs),
    apiCpuPercent: api?.cpuPercent ?? null,
    apiMemBytes: api?.memBytes ?? null,
    containers
  };
}

export function parseEvolutionMetricsBatch(
  body: unknown,
  nowMs = Date.now()
): SampleRow[] {
  const { samples } = obj(body, "body");
  if (
    !Array.isArray(samples) ||
    samples.length === 0 ||
    samples.length > EVOLUTION_METRICS_MAX_BATCH
  ) {
    fail("samples", `array 1..${EVOLUTION_METRICS_MAX_BATCH}`);
  }
  return samples.map((s, i) => parseSample(s, `samples[${i}]`, nowMs));
}

/** Persiste o lote; reenvio do mesmo (source, collectedAt) é ignorado (idempotente). */
export async function ingestEvolutionMetrics(
  body: unknown
): Promise<{ received: number }> {
  const rows = parseEvolutionMetricsBatch(body);
  await EvolutionMetricSample.bulkCreate(rows as never[], {
    ignoreDuplicates: true
  });
  return { received: rows.length };
}

// --------------------------------------------------------------------- leitura

const pct = (part: number, total: number): number | null =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : null;
const secondsSince = (
  iso: string | Date | null,
  nowMs: number
): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : Math.max(0, Math.floor((nowMs - ms) / 1000));
};

export type EvolutionCollectorStatus =
  | "online"
  | "stale"
  | "no_data"
  | "not_configured";

export async function getEvolutionInfraCurrent(nowMs = Date.now()) {
  const latest = await EvolutionMetricSample.findOne({
    order: [["collectedAt", "DESC"]]
  });
  if (!latest) {
    return {
      collector: {
        status: (isEvolutionMetricsIngestConfigured()
          ? "no_data"
          : "not_configured") as EvolutionCollectorStatus,
        source: null,
        lastCollectedAt: null,
        ageSeconds: null,
        staleAfterSeconds: EVOLUTION_METRICS_STALE_AFTER_SECONDS
      },
      host: null,
      services: { api: null, postgres: null, redis: null }
    };
  }

  const ageSeconds = secondsSince(latest.collectedAt, nowMs);
  const stale =
    (ageSeconds ?? Infinity) > EVOLUTION_METRICS_STALE_AFTER_SECONDS;
  // Amostra velha: valores ficam como "última leitura", mas uptime não é extrapolado.
  const liveSeconds = (since: string | Date | null) =>
    stale ? null : secondsSince(since, nowMs);

  const memTotal = Number(latest.hostMemTotalBytes);
  const memUsed = Number(latest.hostMemUsedBytes);
  const diskTotal = Number(latest.hostDiskTotalBytes);
  const diskUsed = Number(latest.hostDiskUsedBytes);

  const services = Object.fromEntries(
    ROLES.map(role => {
      const c = (latest.containers || []).find(item => item.role === role);
      if (!c) return [role, null];
      return [
        role,
        {
          name: c.name,
          state: c.state,
          running: c.running,
          health: c.health,
          startedAt: c.startedAt,
          uptimeSeconds: c.running ? liveSeconds(c.startedAt) : null,
          restartCount: c.restartCount,
          oomKilled: c.oomKilled,
          cpuPercent: c.cpuPercent,
          memBytes: c.memBytes,
          memLimitBytes: c.memLimitBytes,
          image: c.image
        }
      ];
    })
  );

  return {
    collector: {
      status: (stale ? "stale" : "online") as EvolutionCollectorStatus,
      source: latest.source,
      lastCollectedAt: new Date(latest.collectedAt).toISOString(),
      ageSeconds,
      staleAfterSeconds: EVOLUTION_METRICS_STALE_AFTER_SECONDS
    },
    host: {
      cpuPercent: latest.hostCpuPercent,
      cpuCores: latest.hostCpuCores,
      memory: {
        totalBytes: memTotal,
        usedBytes: memUsed,
        availableBytes: Number(latest.hostMemAvailableBytes),
        usedPercent: pct(memUsed, memTotal)
      },
      disk: {
        totalBytes: diskTotal,
        usedBytes: diskUsed,
        availableBytes: Number(latest.hostDiskAvailableBytes),
        usedPercent: pct(diskUsed, diskTotal)
      },
      loadAverage: [latest.hostLoad1, latest.hostLoad5, latest.hostLoad15],
      bootAt: new Date(latest.hostBootAt).toISOString(),
      uptimeSeconds: liveSeconds(latest.hostBootAt)
    },
    services
  };
}

type BucketRow = {
  bucket: string;
  hostCpu: number | null;
  hostMem: number | null;
  apiCpu: number | null;
  apiMem: number | null;
  samples: number;
};

const round1 = (v: unknown): number | null =>
  v == null ? null : Math.round(Number(v) * 10) / 10;

/**
 * Médias por janela (5 min em 24h, 30 min em 7d). A série começa na primeira
 * amostra existente; janelas sem amostra voltam null (lacuna, sem interpolação).
 */
export async function getEvolutionInfraHistory(
  range: HistoryRange,
  nowMs = Date.now()
) {
  const { seconds, bucketSeconds } = HISTORY_RANGES[range];
  const since = new Date(nowMs - seconds * 1000);
  const rows = await EvolutionMetricSample.sequelize.query<BucketRow>(
    `SELECT floor(extract(epoch FROM "collectedAt") / :bucketSeconds)::bigint AS "bucket",
            avg("hostCpuPercent") AS "hostCpu",
            avg("hostMemUsedBytes"::float8 * 100 / NULLIF("hostMemTotalBytes", 0)) AS "hostMem",
            avg("apiCpuPercent") AS "apiCpu",
            avg("apiMemBytes")::float8 AS "apiMem",
            count(*)::int AS "samples"
       FROM "EvolutionMetricSamples"
      WHERE "collectedAt" >= :since
      GROUP BY 1
      ORDER BY 1`,
    { type: QueryTypes.SELECT, replacements: { bucketSeconds, since } }
  );

  const byBucket = new Map(rows.map(r => [Number(r.bucket), r]));
  const points = [];
  if (rows.length) {
    const last = Math.floor(nowMs / 1000 / bucketSeconds);
    for (let b = Number(rows[0].bucket); b <= last; b += 1) {
      const r = byBucket.get(b);
      points.push({
        t: new Date(b * bucketSeconds * 1000).toISOString(),
        hostCpuPercent: round1(r?.hostCpu),
        hostMemPercent: round1(r?.hostMem),
        apiCpuPercent: round1(r?.apiCpu),
        apiMemBytes: r?.apiMem == null ? null : Math.round(Number(r.apiMem)),
        samples: r?.samples ?? 0
      });
    }
  }

  return {
    range,
    bucketSeconds,
    since: since.toISOString(),
    sampleCount: rows.reduce((sum, r) => sum + Number(r.samples), 0),
    points
  };
}

export async function purgeExpiredEvolutionMetrics(
  nowMs = Date.now()
): Promise<number> {
  return EvolutionMetricSample.destroy({
    where: {
      collectedAt: {
        [Op.lt]: new Date(nowMs - EVOLUTION_METRICS_RETENTION_DAYS * DAY_MS)
      }
    }
  });
}
