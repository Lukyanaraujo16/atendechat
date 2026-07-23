import { beatAgentOsWorker, markWorkerDraining } from "./WorkerRegistry";
import { scheduleDefaultAgentOsJobs } from "./JobRunner";
import { getScalabilityConfig } from "./ScalabilityConfig";
import { agentOsLog } from "../observability/StructuredLogger";

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;

export async function startAgentOsScalabilityRuntime(): Promise<void> {
  if (!getScalabilityConfig().startupRecoveryEnabled) return;
  try {
    await beatAgentOsWorker("online");
    await scheduleDefaultAgentOsJobs();
    // Wave 5: hydrate não bloqueia boot indefinidamente (lazy por tenant via API/job)
    agentOsLog("info", {
      type: "production.hydrate_policy",
      mode: "lazy_db_first",
      rolloutDefault: "DISABLED"
    });
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (shuttingDown) return;
      void beatAgentOsWorker("online");
    }, getScalabilityConfig().workerHeartbeatMs);
    agentOsLog("info", { type: "scalability.startup", ok: true });
  } catch (err) {
    agentOsLog("warn", {
      type: "scalability.startup_error",
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

export async function stopAgentOsScalabilityRuntime(): Promise<void> {
  shuttingDown = true;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  try {
    await markWorkerDraining();
  } catch {
    /* */
  }
  agentOsLog("info", { type: "scalability.shutdown", ok: true });
}
