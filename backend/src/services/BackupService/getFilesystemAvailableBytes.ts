import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { getBackupsRoot } from "../../config/backup";
import { logger } from "../../utils/logger";

const execFileAsync = promisify(execFile);

const DF_TIMEOUT_MS = 15_000;

function parseDfPkLine(stdout: string, targetPath: string): number | null {
  const lines = stdout.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return null;
  const resolved = path.resolve(targetPath);
  for (let i = lines.length - 1; i >= 1; i--) {
    const parts = lines[i].split(/\s+/);
    if (parts.length < 4) continue;
    const availK = Number.parseInt(parts[3], 10);
    const mount = parts[parts.length - 1];
    if (!Number.isFinite(availK) || availK < 0) continue;
    if (resolved === mount || resolved.startsWith(`${mount}${path.sep}`)) {
      return availK * 1024;
    }
  }
  const fallback = lines[lines.length - 1].split(/\s+/);
  const availK = Number.parseInt(fallback[3], 10);
  return Number.isFinite(availK) && availK >= 0 ? availK * 1024 : null;
}

async function availableViaDf(targetPath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("df", ["-Pk", "--", targetPath], {
      timeout: DF_TIMEOUT_MS,
      maxBuffer: 64 * 1024,
      windowsHide: true
    });
    return parseDfPkLine(stdout, targetPath);
  } catch {
    return null;
  }
}

async function availableViaStatfs(targetPath: string): Promise<number | null> {
  const statfsFn = (fs.promises as { statfs?: (p: string) => Promise<{ bavail: bigint; bsize: bigint }> })
    .statfs;
  if (typeof statfsFn !== "function") return null;
  try {
    const st = await statfsFn(targetPath);
    const avail = Number(st.bavail) * Number(st.bsize);
    return Number.isFinite(avail) && avail >= 0 ? avail : null;
  } catch {
    return null;
  }
}

/**
 * Espaço livre no volume onde ficam os backups (bytes).
 */
export async function getFilesystemAvailableBytes(): Promise<number> {
  const root = getBackupsRoot();
  await fs.promises.mkdir(root, { recursive: true }).catch(() => {});

  const statfsBytes = await availableViaStatfs(root);
  if (statfsBytes !== null) return statfsBytes;

  const dfBytes = await availableViaDf(root);
  if (dfBytes !== null) return dfBytes;

  logger.warn("[backup-disk] statfs and df failed for backups root");
  throw new Error("BACKUP_DISK_SPACE_CHECK_UNAVAILABLE");
}
