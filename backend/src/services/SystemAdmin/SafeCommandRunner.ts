import { spawn } from "child_process";
import { resolveAppRoot } from "../../helpers/appRoot";
import { resolveBackendServiceName } from "../../helpers/backendServiceName";
import { assertProjectSubdir } from "../../helpers/projectDirs";
import { sanitizeSystemLogLine } from "../../helpers/sanitizeSystemLog";

export type SystemUpdateAction =
  | "git_status"
  | "git_log"
  | "git_pull"
  | "backend_npm_install"
  | "backend_build"
  | "backend_migrate"
  | "backend_restart"
  | "frontend_npm_install"
  | "frontend_build";

type CwdKey = "root" | "backend" | "frontend";

type CommandContext = {
  backendServiceName: string;
};

interface WhitelistedCommandSpec {
  cmd: string;
  args: string[] | ((ctx: CommandContext) => string[]);
  timeoutMs: number;
  label: string | ((ctx: CommandContext) => string);
  cwdKey: CwdKey;
  restartsBackend?: boolean;
}

export interface ResolvedCommand {
  cmd: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  label: string;
  restartsBackend?: boolean;
}

export const SYSTEM_UPDATE_COMMANDS: Record<
  SystemUpdateAction,
  WhitelistedCommandSpec
> = {
  git_status: {
    cmd: "git",
    args: ["status", "-sb"],
    timeoutMs: 30_000,
    label: "git status -sb",
    cwdKey: "root"
  },
  git_log: {
    cmd: "git",
    args: ["log", "-1", "--format=%H %s (%an, %ar)"],
    timeoutMs: 30_000,
    label: "git log -1",
    cwdKey: "root"
  },
  git_pull: {
    cmd: "git",
    args: ["pull", "--ff-only"],
    timeoutMs: 120_000,
    label: "git pull --ff-only",
    cwdKey: "root"
  },
  backend_npm_install: {
    cmd: "npm",
    args: ["install"],
    timeoutMs: 300_000,
    label: "npm install (backend)",
    cwdKey: "backend"
  },
  backend_build: {
    cmd: "npm",
    args: ["run", "build"],
    timeoutMs: 300_000,
    label: "npm run build (backend)",
    cwdKey: "backend"
  },
  backend_migrate: {
    cmd: "npm",
    args: ["run", "db:migrate"],
    timeoutMs: 300_000,
    label: "npm run db:migrate (backend)",
    cwdKey: "backend"
  },
  backend_restart: {
    cmd: "sudo",
    args: (ctx) => ["systemctl", "restart", ctx.backendServiceName],
    timeoutMs: 60_000,
    label: (ctx) => `sudo systemctl restart ${ctx.backendServiceName}`,
    cwdKey: "root",
    restartsBackend: true
  },
  frontend_npm_install: {
    cmd: "npm",
    args: ["install"],
    timeoutMs: 300_000,
    label: "npm install (frontend)",
    cwdKey: "frontend"
  },
  frontend_build: {
    cmd: "npm",
    args: ["run", "build"],
    timeoutMs: 600_000,
    label: "npm run build (frontend)",
    cwdKey: "frontend"
  }
};

const GIT_ACTIONS = new Set<SystemUpdateAction>([
  "git_status",
  "git_log",
  "git_pull"
]);

export function isGitSystemUpdateAction(action: SystemUpdateAction): boolean {
  return GIT_ACTIONS.has(action);
}

export function isSystemUpdateAction(value: string): value is SystemUpdateAction {
  return Object.prototype.hasOwnProperty.call(SYSTEM_UPDATE_COMMANDS, value);
}

function resolveCwd(cwdKey: CwdKey): string {
  if (cwdKey === "root") {
    return resolveAppRoot().root;
  }
  return assertProjectSubdir(cwdKey);
}

export function resolveWhitelistedCommand(
  action: SystemUpdateAction
): ResolvedCommand {
  const spec = SYSTEM_UPDATE_COMMANDS[action];
  const ctx: CommandContext = {
    backendServiceName: resolveBackendServiceName()
  };
  const args = typeof spec.args === "function" ? spec.args(ctx) : spec.args;
  const label = typeof spec.label === "function" ? spec.label(ctx) : spec.label;
  return {
    cmd: spec.cmd,
    args,
    cwd: resolveCwd(spec.cwdKey),
    timeoutMs: spec.timeoutMs,
    label,
    restartsBackend: spec.restartsBackend
  };
}

export async function runWhitelistedCommand(
  resolved: ResolvedCommand,
  onLine: (line: string) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(resolved.cmd, resolved.args, {
      cwd: resolved.cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        CI: process.env.CI || "false"
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let settled = false;
    let stderrBuf = "";
    let stdoutRemainder = "";
    let stderrRemainder = "";

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("SYSTEM_UPDATE_TIMEOUT"));
    }, resolved.timeoutMs);

    const flushLines = (text: string, isErr: boolean) => {
      const combined = (isErr ? stderrRemainder : stdoutRemainder) + text;
      const lines = combined.split(/\r?\n/);
      const remainder = lines.pop() || "";
      if (isErr) stderrRemainder = remainder;
      else stdoutRemainder = remainder;
      for (const line of lines) {
        if (!line) continue;
        const sanitized = sanitizeSystemLogLine(line);
        onLine(sanitized);
        if (isErr) stderrBuf += `${sanitized}\n`;
      }
    };

    child.stdout?.on("data", (c: Buffer) => flushLines(c.toString("utf8"), false));
    child.stderr?.on("data", (c: Buffer) => flushLines(c.toString("utf8"), true));

    child.on("error", (err) => finish(err));
    child.on("close", (code) => {
      for (const rem of [stdoutRemainder, stderrRemainder]) {
        if (rem.trim()) onLine(sanitizeSystemLogLine(rem.trim()));
      }
      onLine(`[exit code ${code ?? "null"}]`);
      if (code === 0) {
        finish();
        return;
      }
      const msg = stderrBuf.trim() || `exit code ${code}`;
      finish(new Error(msg));
    });
  });
}
