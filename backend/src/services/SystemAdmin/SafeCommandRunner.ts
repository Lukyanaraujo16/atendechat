import { spawn } from "child_process";
import { sanitizeSystemLogLine } from "../../helpers/sanitizeSystemLog";

export type SystemUpdateAction = "git_status" | "git_log" | "git_pull";

export interface WhitelistedCommand {
  cmd: string;
  args: string[];
  timeoutMs: number;
  label: string;
}

export const SYSTEM_UPDATE_COMMANDS: Record<SystemUpdateAction, WhitelistedCommand> =
  {
    git_status: {
      cmd: "git",
      args: ["status", "-sb"],
      timeoutMs: 30_000,
      label: "git status -sb"
    },
    git_log: {
      cmd: "git",
      args: ["log", "-1", "--format=%H %s (%an, %ar)"],
      timeoutMs: 30_000,
      label: "git log -1"
    },
    git_pull: {
      cmd: "git",
      args: ["pull", "--ff-only"],
      timeoutMs: 120_000,
      label: "git pull --ff-only"
    }
  };

export function isSystemUpdateAction(value: string): value is SystemUpdateAction {
  return Object.prototype.hasOwnProperty.call(SYSTEM_UPDATE_COMMANDS, value);
}

export async function runWhitelistedCommand(
  action: SystemUpdateAction,
  cwd: string,
  onLine: (line: string) => void
): Promise<void> {
  const spec = SYSTEM_UPDATE_COMMANDS[action];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(spec.cmd, spec.args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0"
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
    }, spec.timeoutMs);

    const flushLines = (text: string, isErr: boolean): string => {
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
      return remainder;
    };

    child.stdout?.on("data", (c: Buffer) => flushLines(c.toString("utf8"), false));
    child.stderr?.on("data", (c: Buffer) => flushLines(c.toString("utf8"), true));

    child.on("error", (err) => finish(err));
    child.on("close", (code) => {
      for (const rem of [stdoutRemainder, stderrRemainder]) {
        if (rem.trim()) onLine(sanitizeSystemLogLine(rem.trim()));
      }
      if (code === 0) {
        finish();
        return;
      }
      const msg = stderrBuf.trim() || `exit code ${code}`;
      finish(new Error(msg));
    });
  });
}
