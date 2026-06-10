import AppError from "../../errors/AppError";
import { assertAppRootIsGitRepo, resolveAppRoot } from "../../helpers/appRoot";
import { logger } from "../../utils/logger";
import {
  emitSystemUpdateDone,
  emitSystemUpdateLog,
  emitSystemUpdateStart
} from "../../libs/systemUpdateRealtime";
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

    emitSystemUpdateStart(userId, {
      jobId,
      action,
      command: resolved.label,
      restartsBackend: resolved.restartsBackend
    });
    emitSystemUpdateLog(userId, {
      jobId,
      line: `[${new Date().toISOString()}] ${resolved.label}`,
      ts: new Date().toISOString()
    });
    emitSystemUpdateLog(userId, {
      jobId,
      line: `[cwd] ${resolved.cwd}`,
      ts: new Date().toISOString()
    });

    const started = Date.now();
    try {
      await runWhitelistedCommand(resolved, (line) => {
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
      emitSystemUpdateLog(userId, {
        jobId,
        line: `[${new Date().toISOString()}] Erro: ${message}`,
        ts: new Date().toISOString()
      });
      const hint = action === "backend_restart" ? sudoHintLine(message) : null;
      if (hint) {
        emitSystemUpdateLog(userId, {
          jobId,
          line: hint,
          ts: new Date().toISOString()
        });
      }
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
        err.message === "SYSTEM_UPDATE_PACKAGE_JSON_MISSING")
    ) {
      emitSystemUpdateLog(userId, {
        jobId,
        line: `[${new Date().toISOString()}] Erro: ${err.message}`,
        ts: new Date().toISOString()
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
