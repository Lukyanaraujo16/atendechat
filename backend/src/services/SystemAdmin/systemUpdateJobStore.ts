import { SystemUpdateAction } from "./SafeCommandRunner";

const MAX_LOG_LINES = 500;

export type SystemUpdateJobStatus = "running" | "success" | "failed" | "timeout";

export type SystemUpdateJobLogLine = {
  line: string;
  ts: string;
};

export type SystemUpdateJobSnapshot = {
  jobId: string;
  action: SystemUpdateAction;
  userId: number;
  status: SystemUpdateJobStatus;
  command?: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  message?: string;
  logs: SystemUpdateJobLogLine[];
};

let activeJob: SystemUpdateJobSnapshot | null = null;
let lastJob: SystemUpdateJobSnapshot | null = null;

export function beginSystemUpdateJobSnapshot(params: {
  jobId: string;
  action: SystemUpdateAction;
  userId: number;
  command: string;
}): void {
  activeJob = {
    jobId: params.jobId,
    action: params.action,
    userId: params.userId,
    status: "running",
    command: params.command,
    startedAt: Date.now(),
    logs: []
  };
}

export function appendSystemUpdateJobLog(
  userId: number,
  jobId: string,
  line: string,
  ts: string
): void {
  if (!activeJob || activeJob.jobId !== jobId || activeJob.userId !== userId) {
    return;
  }
  activeJob.logs.push({ line, ts });
  if (activeJob.logs.length > MAX_LOG_LINES) {
    activeJob.logs.splice(0, activeJob.logs.length - MAX_LOG_LINES);
  }
}

export function finishSystemUpdateJobSnapshot(params: {
  userId: number;
  jobId: string;
  status: SystemUpdateJobStatus;
  durationMs?: number;
  message?: string;
}): void {
  if (!activeJob || activeJob.jobId !== params.jobId || activeJob.userId !== params.userId) {
    return;
  }
  activeJob.status = params.status;
  activeJob.finishedAt = Date.now();
  activeJob.durationMs = params.durationMs;
  activeJob.message = params.message;
  lastJob = activeJob;
  activeJob = null;
}

export function getSystemUpdateJobSnapshotForUser(userId: number): {
  active: boolean;
  job: SystemUpdateJobSnapshot | null;
} {
  if (activeJob?.userId === userId) {
    return { active: true, job: activeJob };
  }
  if (lastJob?.userId === userId) {
    return { active: false, job: lastJob };
  }
  return { active: false, job: null };
}
