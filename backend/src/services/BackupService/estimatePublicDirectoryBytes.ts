import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import uploadConfig from "../../config/upload";
import { logger } from "../../utils/logger";

const execFileAsync = promisify(execFile);

export const DU_TIMEOUT_MS = 120_000;
export const NODE_WALK_TIMEOUT_MS = 180_000;
const YIELD_EVERY = 500;

const DU_CANDIDATES = ["/usr/bin/du", "/bin/du", "du"];

function parseDuOutput(stdout: string): number | null {
  const line = stdout.trim().split("\n")[0]?.trim();
  if (!line) return null;
  const match = /^(\d+)/.exec(line);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function measureWithDu(
  targetPath: string
): Promise<{ bytes: number } | { reason: string }> {
  const started = Date.now();
  let reason = "du_unavailable";
  for (const bin of DU_CANDIDATES) {
    try {
      const { stdout } = await execFileAsync(bin, ["-sb", "--", targetPath], {
        timeout: DU_TIMEOUT_MS,
        maxBuffer: 64 * 1024,
        windowsHide: true
      });
      const bytes = parseDuOutput(stdout);
      if (bytes === null) {
        reason = "du_invalid_output";
        continue;
      }
      logger.info(
        `[backup-disk] method=du bytes=${bytes} durationMs=${Date.now() - started}`
      );
      return { bytes };
    } catch (err: unknown) {
      const e = err as { killed?: boolean; code?: string; signal?: string };
      if (e.killed || e.code === "ETIMEDOUT") {
        reason = "du_timeout";
      } else if (e.code === "ENOENT") {
        reason = "du_not_found";
      } else {
        reason = "du_exec_error";
      }
    }
  }
  return { reason };
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function walkDirectoryBytes(
  dirPath: string,
  deadlineMs: number
): Promise<number> {
  let total = 0;
  let entriesSinceYield = 0;

  async function walk(current: string): Promise<void> {
    if (Date.now() > deadlineMs) {
      throw new Error("NODE_WALK_TIMEOUT");
    }
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (Date.now() > deadlineMs) {
        throw new Error("NODE_WALK_TIMEOUT");
      }
      const full = path.join(current, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        try {
          const st = await fs.promises.stat(full);
          total += st.size;
        } catch {
          /* ignore unreadable file */
        }
      }
      entriesSinceYield += 1;
      if (entriesSinceYield >= YIELD_EVERY) {
        entriesSinceYield = 0;
        await yieldToEventLoop();
      }
    }
  }

  await walk(dirPath);
  return total;
}

async function measureWithNodeWalk(
  targetPath: string,
  reason: string
): Promise<number> {
  const started = Date.now();
  const deadlineMs = started + NODE_WALK_TIMEOUT_MS;
  const bytes = await walkDirectoryBytes(targetPath, deadlineMs);
  logger.info(
    `[backup-disk] method=node-fallback bytes=${bytes} durationMs=${Date.now() - started} reason=${reason}`
  );
  return bytes;
}

/**
 * Tamanho em bytes da pasta public (uploads). Linux: `du -sb`; fallback walk em Node.
 */
export async function estimatePublicDirectoryBytes(): Promise<number> {
  const targetPath = path.resolve(uploadConfig.directory);

  try {
    const st = await fs.promises.stat(targetPath);
    if (!st.isDirectory()) return 0;
  } catch {
    return 0;
  }

  const duResult = await measureWithDu(targetPath);
  if ("bytes" in duResult) return duResult.bytes;

  try {
    return await measureWithNodeWalk(targetPath, duResult.reason);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "NODE_WALK_TIMEOUT") {
      throw new Error("BACKUP_DISK_SPACE_ESTIMATE_FAILED:public_timeout");
    }
    throw new Error("BACKUP_DISK_SPACE_ESTIMATE_FAILED:public_walk");
  }
}
