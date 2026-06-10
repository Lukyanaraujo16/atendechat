import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { resolveAppRoot } from "../../helpers/appRoot";
import { sanitizeSystemLogLine } from "../../helpers/sanitizeSystemLog";
import { logger } from "../../utils/logger";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 10_000;
const DF_TIMEOUT_MS = 10_000;
const DU_TIMEOUT_MS = 8_000;
const PROJECT_SIZE_CACHE_MS = 60_000;

let projectSizeCache: { bytes: number | null; at: number } | null = null;

type DiskStats = {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  method: "statfs" | "df" | "unknown";
};

async function runGit(
  args: string[],
  cwd: string
): Promise<{ ok: true; stdout: string } | { ok: false; error: string }> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 256 * 1024,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
    });
    return { ok: true, stdout: stdout.trim() };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: String(e.message || "git_error") };
  }
}

async function getDiskStats(targetPath: string): Promise<DiskStats> {
  const statfsFn = (fs.promises as {
    statfs?: (p: string) => Promise<{ blocks: bigint; bavail: bigint; bsize: bigint }>;
  }).statfs;

  if (typeof statfsFn === "function") {
    try {
      const st = await statfsFn(targetPath);
      const bsize = Number(st.bsize);
      const totalBytes = Number(st.blocks) * bsize;
      const freeBytes = Number(st.bavail) * bsize;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPercent =
        totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
      return { totalBytes, usedBytes, freeBytes, usedPercent, method: "statfs" };
    } catch {
      /* fall through */
    }
  }

  try {
    const { stdout } = await execFileAsync("df", ["-Pk", "--", targetPath], {
      timeout: DF_TIMEOUT_MS,
      maxBuffer: 64 * 1024,
      windowsHide: true
    });
    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length >= 2) {
      const parts = lines[lines.length - 1].split(/\s+/);
      if (parts.length >= 4) {
        const totalK = Number.parseInt(parts[1], 10);
        const usedK = Number.parseInt(parts[2], 10);
        const availK = Number.parseInt(parts[3], 10);
        if (
          Number.isFinite(totalK) &&
          Number.isFinite(usedK) &&
          Number.isFinite(availK)
        ) {
          const totalBytes = totalK * 1024;
          const usedBytes = usedK * 1024;
          const freeBytes = availK * 1024;
          const usedPercent =
            totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
          return { totalBytes, usedBytes, freeBytes, usedPercent, method: "df" };
        }
      }
    }
  } catch {
    /* fall through */
  }

  return {
    totalBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
    usedPercent: 0,
    method: "unknown"
  };
}

function sampleCpuUsagePercent(): Promise<number> {
  const snap1 = os.cpus();
  return new Promise((resolve) => {
    setTimeout(() => {
      const snap2 = os.cpus();
      let idleDiff = 0;
      let totalDiff = 0;
      for (let i = 0; i < snap2.length; i++) {
        const a = snap1[i]?.times;
        const b = snap2[i]?.times;
        if (!a || !b) continue;
        const idle = b.idle - a.idle;
        const total =
          b.user -
          a.user +
          (b.nice - a.nice) +
          (b.sys - a.sys) +
          (b.irq - a.irq) +
          idle;
        idleDiff += idle;
        totalDiff += total;
      }
      const pct =
        totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
      resolve(Math.min(100, Math.max(0, pct)));
    }, 250);
  });
}

async function measureProjectBytes(root: string): Promise<number | null> {
  const now = Date.now();
  if (
    projectSizeCache &&
    now - projectSizeCache.at < PROJECT_SIZE_CACHE_MS
  ) {
    return projectSizeCache.bytes;
  }

  let bytes: number | null = null;
  try {
    const { stdout } = await execFileAsync("du", ["-sb", "--", root], {
      timeout: DU_TIMEOUT_MS,
      maxBuffer: 64 * 1024,
      windowsHide: true
    });
    const match = /^(\d+)/.exec(stdout.trim());
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n >= 0) bytes = n;
    }
  } catch {
    logger.debug("[system-monitor] du failed for project size");
  }

  projectSizeCache = { bytes, at: now };
  return bytes;
}

export async function getSystemMonitorSnapshot() {
  const { root, strategy } = resolveAppRoot();
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsed = memTotal - memFree;
  const memUsedPercent =
    memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;

  const [cpuPercent, disk, projectSizeBytes] = await Promise.all([
    sampleCpuUsagePercent(),
    getDiskStats(root),
    measureProjectBytes(root)
  ]);

  let gitBranch: string | null = null;
  let gitLastCommit: string | null = null;
  let gitStatusSummary: string | null = null;
  let gitAvailable = false;

  if (fs.existsSync(path.join(root, ".git"))) {
    gitAvailable = true;
    const [branchRes, logRes, statusRes] = await Promise.all([
      runGit(["rev-parse", "--abbrev-ref", "HEAD"], root),
      runGit(["log", "-1", "--format=%h %s"], root),
      runGit(["status", "-sb"], root)
    ]);
    if (branchRes.ok) gitBranch = sanitizeSystemLogLine(branchRes.stdout);
    if (logRes.ok) gitLastCommit = sanitizeSystemLogLine(logRes.stdout);
    if (statusRes.ok) {
      const firstLine = statusRes.stdout.split("\n")[0] || "";
      gitStatusSummary = sanitizeSystemLogLine(firstLine);
    }
  }

  return {
    collectedAt: new Date().toISOString(),
    appRoot: { path: root, strategy },
    backend: {
      status: "online",
      processUptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid
    },
    cpu: {
      cores: os.cpus().length,
      usagePercent: cpuPercent
    },
    memory: {
      totalBytes: memTotal,
      usedBytes: memUsed,
      freeBytes: memFree,
      usedPercent: memUsedPercent
    },
    disk,
    uptime: {
      systemSeconds: Math.floor(os.uptime()),
      processSeconds: Math.floor(process.uptime())
    },
    loadAverage: os.loadavg(),
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    env: {
      nodeEnv: process.env.NODE_ENV || "development"
    },
    git: {
      available: gitAvailable,
      branch: gitBranch,
      lastCommit: gitLastCommit,
      statusSummary: gitStatusSummary
    },
    project: {
      sizeBytes: projectSizeBytes
    }
  };
}
