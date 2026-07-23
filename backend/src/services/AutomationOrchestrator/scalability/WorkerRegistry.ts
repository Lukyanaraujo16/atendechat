import { hostname } from "os";
import { randomBytes } from "crypto";
import { getAgentOsCacheProvider } from "./providers";
import { getScalabilityConfig } from "./ScalabilityConfig";
import { AUTOMATION_AGENTOS_SCALABILITY_VERSION } from "../../../config/automationAgentOsScalabilityConstants";

export type WorkerRecord = {
  workerId: string;
  instanceId: string;
  hostname: string;
  version: string;
  capabilities: string[];
  lastHeartbeatAt: string;
  startedAt: string;
  status: "online" | "draining" | "offline";
};

const startedAt = new Date().toISOString();
const instanceId =
  process.env.AGENTOS_INSTANCE_ID ||
  `inst_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
const workerId =
  process.env.AGENTOS_WORKER_ID ||
  `worker_${instanceId}`;

export function getAgentOsInstanceId(): string {
  return instanceId;
}

export function getAgentOsWorkerId(): string {
  return workerId;
}

export async function beatAgentOsWorker(
  status: WorkerRecord["status"] = "online"
): Promise<WorkerRecord> {
  const cfg = getScalabilityConfig();
  const rec: WorkerRecord = {
    workerId,
    instanceId,
    hostname: hostname().slice(0, 64),
    version: AUTOMATION_AGENTOS_SCALABILITY_VERSION,
    capabilities: ["jobs", "observability", "cleanup"],
    lastHeartbeatAt: new Date().toISOString(),
    startedAt,
    status
  };
  await getAgentOsCacheProvider().set(
    `worker:${workerId}`,
    JSON.stringify(rec),
    cfg.workerStaleMs * 2
  );
  await getAgentOsCacheProvider().set(
    `worker:index:${workerId}`,
    "1",
    cfg.workerStaleMs * 2
  );
  return rec;
}

export async function listAgentOsWorkers(): Promise<WorkerRecord[]> {
  // Limited: without SCAN we track current worker; multi-node listing best-effort
  const raw = await getAgentOsCacheProvider().get(`worker:${workerId}`);
  if (!raw) return [];
  try {
    return [JSON.parse(raw) as WorkerRecord];
  } catch {
    return [];
  }
}

export async function markWorkerDraining(): Promise<void> {
  await beatAgentOsWorker("draining");
}
