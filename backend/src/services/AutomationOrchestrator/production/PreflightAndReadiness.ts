import {
  PreflightStatus,
  ReleaseStatus,
  AUTOMATION_AGENTOS_VERSION,
  AGENTOS_SCHEMA_VERSION,
  AGENTOS_API_VERSION,
  AGENTOS_WORKER_VERSION,
  DEFAULT_AGENTOS_PRODUCTION_FLAGS
} from "../../../config/automationAgentOsProductionConstants";
import { getAgentOsPersistenceBackend } from "../persistence/persistenceUtils";
import { isRedisAvailableForAgentOs } from "../scalability/ScalabilityConfig";
import { buildScalabilityHealth, getQueueHealthProbe } from "../scalability/HealthProbes";
import { listAgentOsWorkers } from "../scalability/WorkerRegistry";
import { loadRolloutConfig } from "./RolloutStateMachine";
import { resolveKillSwitch } from "./KillSwitchService";
import { REDIS_URI_CONNECTION } from "../../../config/redis";

export type CheckItem = {
  status: "PASS" | "WARNING" | "FAIL";
  severity: "info" | "warn" | "critical";
  code: string;
  description: string;
  evidence?: string;
  remediation?: string;
  checkedAt: string;
};

function item(
  status: CheckItem["status"],
  code: string,
  description: string,
  extra?: Partial<CheckItem>
): CheckItem {
  return {
    status,
    severity: status === "FAIL" ? "critical" : status === "WARNING" ? "warn" : "info",
    code,
    description,
    checkedAt: new Date().toISOString(),
    ...extra
  };
}

export async function runPreflight(companyId: number): Promise<{
  status: PreflightStatus;
  checks: CheckItem[];
  acceptedWarningsRequired: boolean;
}> {
  const checks: CheckItem[] = [];
  const cfg = await loadRolloutConfig(companyId);

  checks.push(
    item(
      getAgentOsPersistenceBackend() === "sequelize" ? "PASS" : "FAIL",
      "PERSISTENCE",
      `AGENTOS_PERSISTENCE=${getAgentOsPersistenceBackend()}`,
      { remediation: "Definir AGENTOS_PERSISTENCE=sequelize" }
    )
  );

  checks.push(
    item(
      isRedisAvailableForAgentOs() || process.env.NODE_ENV === "test"
        ? "PASS"
        : "WARNING",
      "REDIS",
      isRedisAvailableForAgentOs() ? "REDIS_URI presente" : "REDIS_URI ausente",
      { remediation: "Configurar REDIS_URI para multi-node" }
    )
  );

  try {
    const qh = await getQueueHealthProbe();
    checks.push(
      item(
        qh.status === "Critical" ? "FAIL" : qh.status === "Degraded" ? "WARNING" : "PASS",
        "QUEUE",
        `queue status=${qh.status}`
      )
    );
  } catch {
    checks.push(item("WARNING", "QUEUE", "queue probe falhou"));
  }

  try {
    const health = await buildScalabilityHealth(companyId);
    checks.push(
      item(
        health.status === "Critical" ? "FAIL" : health.status === "Degraded" ? "WARNING" : "PASS",
        "HEALTH",
        `health=${health.status}`
      )
    );
  } catch {
    checks.push(item("FAIL", "HEALTH", "health probe falhou"));
  }

  const workers = await listAgentOsWorkers();
  checks.push(
    item(
      workers.length > 0 || process.env.NODE_ENV === "test" ? "PASS" : "WARNING",
      "WORKERS",
      `workers=${workers.length}`
    )
  );

  const kill = await resolveKillSwitch({ companyId, component: "agentos" });
  checks.push(
    item(
      kill.denied ? "FAIL" : "PASS",
      "KILL_SWITCH",
      kill.denied ? `kill ativo: ${kill.reasonCode}` : "sem kill switch"
    )
  );

  checks.push(
    item(
      cfg.flags.liveEnabled === true ? "WARNING" : "PASS",
      "LIVE_DEFAULT",
      `liveEnabled=${cfg.flags.liveEnabled}`
    )
  );
  checks.push(
    item(
      cfg.flags.mcpWriteEnabled || cfg.flags.toolWriteEnabled ? "WARNING" : "PASS",
      "WRITE_DEFAULTS",
      `toolWrite=${cfg.flags.toolWriteEnabled} mcpWrite=${cfg.flags.mcpWriteEnabled}`
    )
  );
  checks.push(
    item("PASS", "FLAGS_DEFAULT", JSON.stringify(DEFAULT_AGENTOS_PRODUCTION_FLAGS))
  );
  checks.push(
    item(
      cfg.rolloutState === "DISABLED" ? "PASS" : "WARNING",
      "ROLLOUT_STATE",
      `state=${cfg.rolloutState}`
    )
  );

  const fails = checks.filter(c => c.status === "FAIL");
  const warns = checks.filter(c => c.status === "WARNING");
  const status: PreflightStatus = fails.length
    ? "FAIL"
    : warns.length
      ? "PASS_WITH_WARNINGS"
      : "PASS";

  return {
    status,
    checks,
    acceptedWarningsRequired: status === "PASS_WITH_WARNINGS"
  };
}

export async function runReleaseReadiness(companyId: number): Promise<{
  status: ReleaseStatus;
  version: {
    agentOsVersion: string;
    schemaVersion: string;
    apiVersion: string;
    workerVersion: string;
    buildVersion: string;
    gitCommit: string | null;
  };
  categories: Record<string, CheckItem[]>;
  blockers: CheckItem[];
  warnings: CheckItem[];
}> {
  const preflight = await runPreflight(companyId);
  const envChecks: CheckItem[] = [
    item(
      process.env.NODE_ENV === "production" ? "PASS" : "WARNING",
      "NODE_ENV",
      `NODE_ENV=${process.env.NODE_ENV || "undefined"}`
    ),
    item(
      Boolean(REDIS_URI_CONNECTION) || process.env.NODE_ENV === "test"
        ? "PASS"
        : "WARNING",
      "REDIS_URI",
      REDIS_URI_CONNECTION ? "presente" : "ausente"
    ),
    item(
      process.env.JWT_SECRET || process.env.NODE_ENV === "test" ? "PASS" : "FAIL",
      "JWT",
      process.env.JWT_SECRET ? "presente" : "ausente"
    )
  ];

  const categories: Record<string, CheckItem[]> = {
    DATABASE: preflight.checks.filter(c => c.code === "PERSISTENCE"),
    CACHE: preflight.checks.filter(c => c.code === "REDIS"),
    QUEUE: preflight.checks.filter(c => c.code === "QUEUE"),
    WORKERS: preflight.checks.filter(c => c.code === "WORKERS"),
    SECURITY: envChecks.filter(c => c.code === "JWT"),
    ENVIRONMENT: envChecks,
    ROLLOUT: preflight.checks.filter(c =>
      ["ROLLOUT_STATE", "LIVE_DEFAULT", "WRITE_DEFAULTS", "KILL_SWITCH"].includes(
        c.code
      )
    ),
    HEALTH: preflight.checks.filter(c => c.code === "HEALTH"),
    BUILD: [
      item("PASS", "AGENTOS_VERSION", AUTOMATION_AGENTOS_VERSION),
      item("PASS", "SCHEMA_VERSION", AGENTOS_SCHEMA_VERSION)
    ]
  };

  const all = Object.values(categories).flat();
  const blockers = all.filter(c => c.status === "FAIL");
  const warnings = all.filter(c => c.status === "WARNING");

  let status: ReleaseStatus = "READY";
  if (blockers.length) status = "BLOCKED";
  else if (warnings.length) status = "READY_WITH_WARNINGS";

  return {
    status: status === "BLOCKED" ? "NOT_READY" : status,
    version: {
      agentOsVersion: AUTOMATION_AGENTOS_VERSION,
      schemaVersion: AGENTOS_SCHEMA_VERSION,
      apiVersion: AGENTOS_API_VERSION,
      workerVersion: AGENTOS_WORKER_VERSION,
      buildVersion: process.env.AGENTOS_BUILD_VERSION || AUTOMATION_AGENTOS_VERSION,
      gitCommit: process.env.GIT_COMMIT || process.env.COMMIT_SHA || null
    },
    categories,
    blockers,
    warnings
  };
}

export function validateEnvironment(): Array<{
  variable: string;
  present: boolean;
  valid: boolean;
  origin: string;
  impact: string;
}> {
  const vars = [
    { variable: "NODE_ENV", impact: "modo runtime" },
    { variable: "REDIS_URI", impact: "cache/locks/filas" },
    { variable: "AGENTOS_PERSISTENCE", impact: "source of truth" },
    { variable: "JWT_SECRET", impact: "auth" },
    { variable: "FRONTEND_URL", impact: "CORS" }
  ];
  return vars.map(v => {
    const val = process.env[v.variable];
    const present = val != null && String(val).length > 0;
    let valid = present;
    if (v.variable === "AGENTOS_PERSISTENCE" && present) {
      valid = val === "sequelize" || val === "memory";
    }
    return {
      variable: v.variable,
      present,
      valid: v.variable === "NODE_ENV" ? true : valid || process.env.NODE_ENV === "test",
      origin: "env",
      impact: v.impact
    };
  });
}
