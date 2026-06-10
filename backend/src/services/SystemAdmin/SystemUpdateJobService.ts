import AppError from "../../errors/AppError";
import { assertAppRootIsGitRepo, resolveAppRoot } from "../../helpers/appRoot";
import { logger } from "../../utils/logger";
import {
  emitSystemUpdateDone,
  emitSystemUpdateLog,
  emitSystemUpdateStart
} from "../../libs/systemUpdateRealtime";
import {
  isSystemUpdateAction,
  runWhitelistedCommand,
  SYSTEM_UPDATE_COMMANDS,
  SystemUpdateAction
} from "./SafeCommandRunner";

let activeJob: {
  id: string;
  action: SystemUpdateAction;
  userId: number;
  startedAt: number;
} | null = null;

export function isSystemUpdateJobRunning(): boolean {
  return activeJob !== null;
}

export function getActiveSystemUpdateJob() {
  return activeJob;
}

export async function startSystemUpdateJob(
  actionKey: string,
  userId: number
): Promise<{ jobId: string; action: SystemUpdateAction }> {
  if (!isSystemUpdateAction(actionKey)) {
    throw new AppError("SYSTEM_UPDATE_INVALID_ACTION", 400);
  }

  if (isSystemUpdateJobRunning()) {
    throw new AppError("SYSTEM_UPDATE_JOB_RUNNING", 409);
  }

  const action = actionKey;
  const jobId = `sysupd-${Date.now()}`;
  activeJob = { id: jobId, action, userId, startedAt: Date.now() };

  const { root } = resolveAppRoot();
  try {
    assertAppRootIsGitRepo(root);
  } catch (err) {
    activeJob = null;
    throw err;
  }

  const spec = SYSTEM_UPDATE_COMMANDS[action];
  emitSystemUpdateStart(userId, {
    jobId,
    action,
    command: spec.label
  });
  emitSystemUpdateLog(userId, {
    jobId,
    line: `[${new Date().toISOString()}] ${spec.label}`,
    ts: new Date().toISOString()
  });

  const started = Date.now();
  try {
    await runWhitelistedCommand(action, root, (line) => {
      emitSystemUpdateLog(userId, {
        jobId,
        line,
        ts: new Date().toISOString()
      });
    });

    const durationMs = Date.now() - started;
    emitSystemUpdateLog(userId, {
      jobId,
      line: `[${new Date().toISOString()}] Finalizado com sucesso (${durationMs}ms)`,
      ts: new Date().toISOString()
    });
    emitSystemUpdateDone(userId, {
      jobId,
      status: "success",
      durationMs
    });
    logger.info(
      { userId, action, status: "success", durationMs, jobId },
      "[system-update] job completed"
    );
    return { jobId, action };
  } catch (err: unknown) {
    const durationMs = Date.now() - started;
    const message = String((err as Error)?.message || err || "unknown");
    const status =
      message === "SYSTEM_UPDATE_TIMEOUT" ? "timeout" : "failed";
    emitSystemUpdateLog(userId, {
      jobId,
      line: `[${new Date().toISOString()}] Erro: ${message}`,
      ts: new Date().toISOString()
    });
    emitSystemUpdateDone(userId, {
      jobId,
      status,
      durationMs,
      message
    });
    logger.warn(
      { userId, action, status, durationMs, jobId, message },
      "[system-update] job failed"
    );
    throw err;
  } finally {
    activeJob = null;
  }
}
