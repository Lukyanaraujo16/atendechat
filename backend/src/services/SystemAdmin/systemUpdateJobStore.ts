import { SystemUpdateJobAction } from "./fullUpdateSequence";

const MAX_LOG_LINES = 500;

export type SystemUpdateJobStatus = "running" | "success" | "failed" | "timeout";

export type FullUpdateStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type FullUpdateStepSnapshot = {
  index: number;
  total: number;
  action: string;
  label: string;
  status: FullUpdateStepStatus;
};

export type SystemUpdateJobLogLine = {
  seq: number;
  line: string;
  ts: string;
};

export type SystemUpdateJobSnapshot = {
  jobId: string;
  action: SystemUpdateJobAction;
  userId: number;
  status: SystemUpdateJobStatus;
  command?: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  message?: string;
  logs: SystemUpdateJobLogLine[];
  steps?: FullUpdateStepSnapshot[];
};

export type InitFullUpdateStepInput = {
  action: string;
  label: string;
};

let activeJob: SystemUpdateJobSnapshot | null = null;
let lastJob: SystemUpdateJobSnapshot | null = null;
let nextLogSeq = 0;

export function beginSystemUpdateJobSnapshot(params: {
  jobId: string;
  action: SystemUpdateJobAction;
  userId: number;
  command: string;
}): void {
  nextLogSeq = 0;
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
): number {
  if (!activeJob || activeJob.jobId !== jobId || activeJob.userId !== userId) {
    return 0;
  }
  nextLogSeq += 1;
  activeJob.logs.push({ seq: nextLogSeq, line, ts });
  if (activeJob.logs.length > MAX_LOG_LINES) {
    const overflow = activeJob.logs.length - MAX_LOG_LINES;
    activeJob.logs.splice(0, overflow);
  }
  return nextLogSeq;
}

export function initFullUpdateStepsSnapshot(
  userId: number,
  jobId: string,
  steps: InitFullUpdateStepInput[]
): void {
  if (!activeJob || activeJob.jobId !== jobId || activeJob.userId !== userId) {
    return;
  }
  activeJob.steps = steps.map((step, idx) => ({
    index: idx + 1,
    total: steps.length,
    action: step.action,
    label: step.label,
    status: "pending" as FullUpdateStepStatus
  }));
}

export function setFullUpdateStepStatus(
  userId: number,
  jobId: string,
  stepIndex: number,
  status: FullUpdateStepStatus
): void {
  if (!activeJob || activeJob.jobId !== jobId || activeJob.userId !== userId) {
    return;
  }
  const step = activeJob.steps?.find((s) => s.index === stepIndex);
  if (step) {
    step.status = status;
  }
}

export function markRemainingFullUpdateStepsSkipped(
  userId: number,
  jobId: string,
  fromStepIndex: number
): void {
  if (!activeJob || activeJob.jobId !== jobId || activeJob.userId !== userId) {
    return;
  }
  activeJob.steps?.forEach((step) => {
    if (step.index > fromStepIndex && step.status === "pending") {
      step.status = "skipped";
    }
  });
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
