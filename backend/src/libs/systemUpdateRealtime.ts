import { getIO } from "./socket";

export type SystemUpdateSocketPayload = {
  jobId: string;
  action?: string;
  command?: string;
  /** true quando a ação reinicia o processo backend (socket pode cair). */
  restartsBackend?: boolean;
  line?: string;
  ts?: string;
  seq?: number;
  status?: "success" | "failed" | "timeout";
  durationMs?: number;
  message?: string;
  stepIndex?: number;
  stepTotal?: number;
  stepLabel?: string;
  stepStatus?: "pending" | "running" | "completed" | "failed" | "skipped";
  steps?: Array<{
    index: number;
    total: number;
    action: string;
    label: string;
    status: string;
  }>;
};

function emitToUser(userId: number | string, event: string, payload: SystemUpdateSocketPayload) {
  const io = getIO();
  io.to(`user-${userId}`).emit(event, payload);
}

export function emitSystemUpdateStart(
  userId: number,
  payload: SystemUpdateSocketPayload
): void {
  emitToUser(userId, "system-update:start", payload);
}

export function emitSystemUpdateLog(
  userId: number,
  payload: SystemUpdateSocketPayload
): void {
  emitToUser(userId, "system-update:log", payload);
}

export function emitSystemUpdateDone(
  userId: number,
  payload: SystemUpdateSocketPayload
): void {
  emitToUser(userId, "system-update:done", payload);
}

export function emitSystemUpdateStep(
  userId: number,
  payload: SystemUpdateSocketPayload
): void {
  emitToUser(userId, "system-update:step", payload);
}
