import { getAgentOsQueueProvider } from "./providers";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { getAgentOsPersistenceBackend } from "../persistence/persistenceUtils";

export type ConsistencyFinding = {
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
  autoFixable: boolean;
};

/**
 * Validador de consistência — relatório; auto-fix só casos seguros.
 */
export async function validateAgentOsConsistency(companyId: number): Promise<{
  findings: ConsistencyFinding[];
  checkedAt: string;
}> {
  const findings: ConsistencyFinding[] = [];
  const backend = getAgentOsPersistenceBackend();
  if (backend !== "sequelize") {
    findings.push({
      code: "PERSISTENCE_MEMORY",
      severity: "warn",
      message: "Persistência em memory — validação limitada",
      autoFixable: false
    });
  }

  const audits = await observabilityRepository.listAudits(companyId, {
    limit: 50
  });
  for (const a of audits as any[]) {
    const row = typeof a.toJSON === "function" ? a.toJSON() : a;
    if (row.companyId == null) {
      findings.push({
        code: "AUDIT_MISSING_COMPANY",
        severity: "error",
        message: `Audit ${row.id} sem companyId`,
        autoFixable: false
      });
    }
  }

  const q = getAgentOsQueueProvider();
  const running = await q.listJobs({ status: "RUNNING", limit: 100 });
  for (const j of running) {
    if (!j.startedAt) continue;
    const age = Date.now() - new Date(j.startedAt).getTime();
    if (age > 15 * 60_000) {
      findings.push({
        code: "STALE_RUNNING_JOB",
        severity: "warn",
        message: `Job ${j.jobId} RUNNING há ${age}ms`,
        autoFixable: true
      });
      // safe auto-fix: mark failed retryable → dead letter after timeout
      await q.markDeadLetter(j.jobId, "STALE_RUNNING");
    }
  }

  return { findings, checkedAt: new Date().toISOString() };
}
