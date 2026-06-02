import { getBackupsRoot, ensureBackupDirs } from "../../config/backup";
import { listBackupFiles } from "./listBackupFiles";
import { deleteBackupZipAndMeta } from "./backupZipMeta";

/**
 * Mantém no máximo `maxToKeep` backups com origem automática; os mais antigos são apagados.
 * Backups manuais e pré-restauração não são tocados.
 */
export async function pruneAutomaticBackups(maxToKeep: number): Promise<string[]> {
  if (maxToKeep < 1) return [];
  ensureBackupDirs();
  const items = await listBackupFiles();
  const automatic = items.filter(
    (i) => i.backupSource === "automatic" && i.status === "ok"
  );
  if (automatic.length <= maxToKeep) return [];

  const sorted = [...automatic].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });

  const toRemove = sorted.slice(0, sorted.length - maxToKeep);
  const deleted: string[] = [];

  for (const item of toRemove) {
    try {
      await deleteBackupZipAndMeta(item.fileName);
      deleted.push(item.fileName);
    } catch {
      /* ignore per file */
    }
  }

  return deleted;
}
