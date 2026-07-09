import AppError from "../../errors/AppError";
import { assertAppRootIsGitRepo, resolveAppRoot } from "../../helpers/appRoot";
import { logger } from "../../utils/logger";
import {
  emitSystemUpdateDone,
  emitSystemUpdateLog,
  emitSystemUpdateStart,
  emitSystemUpdateStep
} from "../../libs/systemUpdateRealtime";
import {
  FULL_UPDATE_JOB_ACTION,
  FULL_UPDATE_SEQUENCE,
  isSystemUpdateJobAction,
  SystemUpdateJobAction
} from "./fullUpdateSequence";
import {
  appendSystemUpdateJobLog,
  beginSystemUpdateJobSnapshot,
  finishSystemUpdateJobSnapshot,
  getSystemUpdateJobSnapshotForUser,
  initFullUpdateStepsSnapshot,
  markRemainingFullUpdateStepsSkipped,
  setFullUpdateStepStatus
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
  action: SystemUpdateJobAction;
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
  const seq = appendSystemUpdateJobLog(userId, jobId, line, iso);
  if (seq > 0) {
    emitSystemUpdateLog(userId, { jobId, line, ts: iso, seq });
  }
}

function emitStep(
  userId: number,
  jobId: string,
  stepIndex: number,
  stepTotal: number,
  stepLabel: string,
  stepStatus: "pending" | "running" | "completed" | "failed" | "skipped",
  action: string
): void {
  setFullUpdateStepStatus(userId, jobId, stepIndex, stepStatus);
  const snapshot = getSystemUpdateJobSnapshotForUser(userId);
  emitSystemUpdateStep(userId, {
    jobId,
    action: FULL_UPDATE_JOB_ACTION,
    stepIndex,
    stepTotal,
    stepLabel,
    stepStatus,
    steps: snapshot.job?.steps
  });
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

const INSTALL_BEFORE_ACTION = new Map<SystemUpdateAction, SystemUpdateAction>([
  ["backend_build", "backend_npm_install"],
  ["backend_migrate", "backend_npm_install"],
  ["frontend_build", "frontend_npm_install"]
]);

async function runWhitelistedStep(
  userId: number,
  jobId: string,
  action: SystemUpdateAction
): Promise<void> {
  const resolved = resolveWhitelistedCommand(action);
  pushJobLog(userId, jobId, `[${new Date().toISOString()}] ${resolved.label}`);
  pushJobLog(userId, jobId, `[cwd] ${resolved.cwd}`);
  await runWhitelistedCommand(resolved, (line) => {
    pushJobLog(userId, jobId, line);
  });
}

async function runSingleStep(
  userId: number,
  jobId: string,
  action: SystemUpdateAction,
  options?: { ensureDepsInstall?: boolean }
): Promise<void> {
  if (options?.ensureDepsInstall) {
    const installAction = INSTALL_BEFORE_ACTION.get(action);
    if (installAction) {
      await runWhitelistedStep(userId, jobId, installAction);
    }
  }
  await runWhitelistedStep(userId, jobId, action);
}

async function runFullUpdateJob(
  userId: number,
  jobId: string
): Promise<{ jobId: string; action: SystemUpdateJobAction }> {
  const total = FULL_UPDATE_SEQUENCE.length;
  const commandLabel = `Atualização completa (${total} etapas)`;

  beginSystemUpdateJobSnapshot({
    jobId,
    action: FULL_UPDATE_JOB_ACTION,
    userId,
    command: commandLabel
  });
  initFullUpdateStepsSnapshot(
    userId,
    jobId,
    FULL_UPDATE_SEQUENCE.map((s) => ({ action: s.action, label: s.stepLabel }))
  );

  emitSystemUpdateStart(userId, {
    jobId,
    action: FULL_UPDATE_JOB_ACTION,
    command: commandLabel,
    restartsBackend: true
  });
  pushJobLog(
    userId,
    jobId,
    `[${new Date().toISOString()}] Iniciando atualização completa (${total} etapas)`
  );

  const flowStarted = Date.now();

  for (let i = 0; i < FULL_UPDATE_SEQUENCE.length; i++) {
    const step = FULL_UPDATE_SEQUENCE[i];
    const stepIndex = i + 1;

    emitStep(userId, jobId, stepIndex, total, step.stepLabel, "running", step.action);
    pushJobLog(
      userId,
      jobId,
      `[STEP ${stepIndex}/${total}] ${step.stepLabel}`
    );

    if (step.action === "backend_restart") {
      pushJobLog(
        userId,
        jobId,
        "Última etapa: reiniciando backend. A conexão pode cair por alguns segundos."
      );
    }

    const stepStarted = Date.now();
    try {
      await runSingleStep(userId, jobId, step.action);
      const stepDurationMs = Date.now() - stepStarted;
      pushJobLog(
        userId,
        jobId,
        `[STEP ${stepIndex}/${total}] Concluída (${stepDurationMs}ms)`
      );
      emitStep(userId, jobId, stepIndex, total, step.stepLabel, "completed", step.action);

      if (step.action === "backend_restart") {
        const durationMs = Date.now() - flowStarted;
        pushJobLog(
          userId,
          jobId,
          `[${new Date().toISOString()}] Atualização completa finalizada (${durationMs}ms)`
        );
        finishSystemUpdateJobSnapshot({
          userId,
          jobId,
          status: "success",
          durationMs
        });
        emitSystemUpdateDone(userId, {
          jobId,
          action: FULL_UPDATE_JOB_ACTION,
          status: "success",
          durationMs
        });
        logger.info(
          { userId, action: FULL_UPDATE_JOB_ACTION, status: "success", durationMs, jobId },
          "[system-update] full update completed"
        );
        activeJob = null;
        return { jobId, action: FULL_UPDATE_JOB_ACTION };
      }
    } catch (err: unknown) {
      const stepDurationMs = Date.now() - stepStarted;
      const message = String((err as Error)?.message || err || "unknown");
      const status =
        message === "SYSTEM_UPDATE_TIMEOUT" ? "timeout" : "failed";

      pushJobLog(
        userId,
        jobId,
        `[STEP ${stepIndex}/${total}] Falhou: ${message} (${stepDurationMs}ms)`
      );
      if (step.action === "backend_restart") {
        const hint = sudoHintLine(message);
        if (hint) pushJobLog(userId, jobId, hint);
      }

      emitStep(userId, jobId, stepIndex, total, step.stepLabel, "failed", step.action);
      markRemainingFullUpdateStepsSkipped(userId, jobId, stepIndex);
      const snapshot = getSystemUpdateJobSnapshotForUser(userId);
      emitSystemUpdateStep(userId, {
        jobId,
        action: FULL_UPDATE_JOB_ACTION,
        steps: snapshot.job?.steps
      });

      const durationMs = Date.now() - flowStarted;
      pushJobLog(
        userId,
        jobId,
        `[${new Date().toISOString()}] Atualização completa interrompida na etapa ${stepIndex}/${total}`
      );
      finishSystemUpdateJobSnapshot({
        userId,
        jobId,
        status,
        durationMs,
        message
      });
      emitSystemUpdateDone(userId, {
        jobId,
        action: FULL_UPDATE_JOB_ACTION,
        status,
        durationMs,
        message
      });
      logger.warn(
        {
          userId,
          action: FULL_UPDATE_JOB_ACTION,
          status,
          durationMs,
          jobId,
          message,
          failedStep: stepIndex
        },
        "[system-update] full update failed"
      );
      throw err;
    }
  }

  const durationMs = Date.now() - flowStarted;
  finishSystemUpdateJobSnapshot({
    userId,
    jobId,
    status: "success",
    durationMs
  });
  emitSystemUpdateDone(userId, {
    jobId,
    action: FULL_UPDATE_JOB_ACTION,
    status: "success",
    durationMs
  });
  return { jobId, action: FULL_UPDATE_JOB_ACTION };
}

async function runSingleActionJob(
  userId: number,
  jobId: string,
  action: SystemUpdateAction
): Promise<{ jobId: string; action: SystemUpdateAction }> {
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

  const started = Date.now();
  try {
    await runSingleStep(userId, jobId, action, { ensureDepsInstall: true });

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
}

export async function startSystemUpdateJob(
  actionKey: string,
  userId: number,
  jobId: string
): Promise<{ jobId: string; action: SystemUpdateJobAction }> {
  if (!isSystemUpdateJobAction(actionKey)) {
    throw new AppError("SYSTEM_UPDATE_INVALID_ACTION", 400);
  }

  if (isSystemUpdateJobRunning()) {
    throw new AppError("SYSTEM_UPDATE_JOB_RUNNING", 409);
  }

  const action = actionKey;
  activeJob = { id: jobId, action, userId, startedAt: Date.now() };

  try {
    const { root } = resolveAppRoot();
    const needsGit =
      action === FULL_UPDATE_JOB_ACTION || isGitSystemUpdateAction(action as SystemUpdateAction);
    if (needsGit) {
      try {
        assertAppRootIsGitRepo(root);
      } catch {
        throw new AppError("APP_ROOT_NOT_GIT_REPO", 400);
      }
    }

    if (action === FULL_UPDATE_JOB_ACTION) {
      return await runFullUpdateJob(userId, jobId);
    }

    return await runSingleActionJob(userId, jobId, action as SystemUpdateAction);
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
