import AppError from "../../errors/AppError";
import { assertAppRootIsGitRepo, resolveAppRoot } from "../../helpers/appRoot";
import { logger } from "../../utils/logger";
import {
  emitSystemUpdateDone,
  emitSystemUpdateLog,
  emitSystemUpdateStart
} from "../../libs/systemUpdateRealtime";
import {
  appendSystemUpdateJobLog,
  beginSystemUpdateJobSnapshot,
  finishSystemUpdateJobSnapshot,
  getSystemUpdateJobSnapshotForUser
} from "./systemUpdateJobStore";
import {
  isGitSystemUpdateAction,
  isSystemUpdateAction,
  resolveWhitelistedCommand,
  runWhitelistedCommand,
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

export function getCurrentSystemUpdateJobForUser(userId: number) {
  return getSystemUpdateJobSnapshotForUser(userId);
}

function pushJobLog(userId: number, jobId: string, line: string, ts?: string): void {
  const iso = ts || new Date().toISOString();
  appendSystemUpdateJobLog(userId, jobId, line, iso);
  emitSystemUpdateLog(userId, { jobId, line, ts: iso });
}

function sudoHintLine(message: string): string | null {
  const lower = message.toLowerCase();
  if (
    lower.includes("password is required") ||
    lower.includes("a terminal is required") ||
    lower.includes("not allowed to execute")
  ) {
    return (
      "Dica: configure sudoers para permitir `systemctl restart` sem senha " +
      "(ex.: NOPASSWD para o serviço definido em BACKEND_SERVICE_NAME)."
    );
  }
  return null;
}

export async function startSystemUpdateJob(
  actionKey: string,
  userId: number,
  jobId: string
): Promise<{ jobId: string; action: SystemUpdateAction }> {
  if (!isSystemUpdateAction(actionKey)) {
    throw new AppError("SYSTEM_UPDATE_INVALID_ACTION", 400);
  }

  if (isSystemUpdateJobRunning()) {
    throw new AppError("SYSTEM_UPDATE_JOB_RUNNING", 409);
  }

  const action = actionKey;
  activeJob = { id: jobId, action, userId, startedAt: Date.now() };

  try {
    const { root } = resolveAppRoot();
    if (isGitSystemUpdateAction(action)) {
      try {
        assertAppRootIsGitRepo(root);
      } catch {
        throw new AppError("APP_ROOT_NOT_GIT_REPO", 400);
      }
    }

    const resolved = resolveWhitelistedCommand(action);
    beginSystemUpdateJobSnapshot({
      jobId,
      action,
      userId,
      command: resolved.label
    });

    emitSystemUpdateStart(userId, {
      jobId,
      action,
      command: resolved.label,
      restartsBackend: resolved.restartsBackend
    });
    pushJobLog(userId, jobId, `[${new Date().toISOString()}] ${resolved.label}`);
    pushJobLog(userId, jobId, `[cwd] ${resolved.cwd}`);

    const started = Date.now();
    try {
      await runWhitelistedCommand(resolved, (line) => {
        pushJobLog(userId, jobId, line);
      });

      const durationMs = Date.now() - started;
      pushJobLog(
        userId,
        jobId,
        `[${new Date().toISOString()}] Finalizado com sucesso (${durationMs}ms)`
      );
      finishSystemUpdateJobSnapshot({
        userId,
        jobId,
        status: "success",
        durationMs
      });
      emitSystemUpdateDone(userId, {
        jobId,
        action,
        status: "success",
        durationMs
      });
      logger.info(
        { userId, action, status: "success", durationMs, jobId },
        "[system-update] job completed"
      );

      if (resolved.restartsBackend) {
        activeJob = null;
      }

      return { jobId, action };
    } catch (err: unknown) {
      const durationMs = Date.now() - started;
      const message = String((err as Error)?.message || err || "unknown");
      const status =
        message === "SYSTEM_UPDATE_TIMEOUT" ? "timeout" : "failed";
      pushJobLog(userId, jobId, `[${new Date().toISOString()}] Erro: ${message}`);
      const hint = action === "backend_restart" ? sudoHintLine(message) : null;
      if (hint) {
        pushJobLog(userId, jobId, hint);
      }
      finishSystemUpdateJobSnapshot({
        userId,
        jobId,
        status,
        durationMs,
        message
      });
      emitSystemUpdateDone(userId, {
        jobId,
        action,
        status,
        durationMs,
        message
      });
      logger.warn(
        { userId, action, status, durationMs, jobId, message },
        "[system-update] job failed"
      );
      throw err;
    }
  } catch (err) {
    if (
      err instanceof AppError &&
      (err.message === "SYSTEM_UPDATE_DIR_NOT_FOUND" ||
        err.message === "SYSTEM_UPDATE_PACKAGE_JSON_MISSING" ||
        err.message === "APP_ROOT_NOT_GIT_REPO")
    ) {
      pushJobLog(userId, jobId, `[${new Date().toISOString()}] Erro: ${err.message}`);
      finishSystemUpdateJobSnapshot({
        userId,
        jobId,
        status: "failed",
        message: err.message
      });
      emitSystemUpdateDone(userId, {
        jobId,
        action,
        status: "failed",
        message: err.message
      });
    }
    throw err;
  } finally {
    if (activeJob?.id === jobId) {
      activeJob = null;
    }
  }
}
