/**
 * Mesmo cálculo que GET /platform/backups/disk-space (sem HTTP).
 * Uso no servidor: npm run build && node dist/scripts/printBackupDiskSpace.js
 */
import "dotenv/config";
import { checkBackupDiskSpace } from "../services/BackupService/checkBackupDiskSpace";

async function main(): Promise<void> {
  const diskSpace = await checkBackupDiskSpace();
  console.log(JSON.stringify({ ok: true, diskSpace }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
