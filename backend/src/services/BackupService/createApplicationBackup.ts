import fs from "fs";
import path from "path";
import archiver from "archiver";
import { createWriteStream } from "fs";
import uploadConfig from "../../config/upload";
import { getBackupsRoot, BACKUP_FILENAME_PREFIX, ensureBackupDirs } from "../../config/backup";
import { dumpDatabaseToFile } from "./dumpDatabase";

function readAppVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, "..", "..", "..", "package.json");
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version || "6.0.0";
  } catch {
    return process.env.npm_package_version || "6.0.0";
  }
}

export type BackupSource = "manual" | "automatic" | "pre_restore";

export interface BackupManifest {
  formatVersion: 1;
  appName: string;
  appVersion: string;
  createdAt: string;
  dbDialect: string;
  dbHost: string;
  dbName: string;
  includesPublicFiles: boolean;
  notes: string;
  /** Origem do backup (histórico no painel). Backups antigos podem não ter o campo. */
  backupSource?: BackupSource;
}

function buildManifest(backupSource: BackupSource): BackupManifest {
  const dialect = (process.env.DB_DIALECT || "mysql").toLowerCase();
  return {
    formatVersion: 1,
    appName: "coreflow",
    appVersion: readAppVersion(),
    createdAt: new Date().toISOString(),
    dbDialect: dialect,
    dbHost: process.env.DB_HOST || "",
    dbName: process.env.DB_NAME || "",
    includesPublicFiles: true,
    backupSource,
    notes:
      "Inclui dump SQL e pasta public (uploads, branding, anexos servidos em /public). " +
      "Não inclui .env, SSL, Redis, filas Bull, nem configuração do SO."
  };
}

export interface CreateApplicationBackupOptions {
  backupSource?: BackupSource;
}

/**
 * Gera ZIP em backups/coreflow-backup-{timestamp}.zip (legado: atendechat-backup-)
 */
export async function createApplicationBackup(
  options?: CreateApplicationBackupOptions
): Promise<{
  fileName: string;
  absolutePath: string;
  manifest: BackupManifest;
  sizeBytes: number;
}> {
  const backupSource: BackupSource = options?.backupSource ?? "manual";
  ensureBackupDirs();
  const tempRoot = path.join(
    getBackupsRoot(),
    `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const tempPublic = path.join(tempRoot, "public");
  const sqlPath = path.join(tempRoot, "database.sql");
  const manifestPath = path.join(tempRoot, "manifest.json");

  await fs.promises.mkdir(tempRoot, { recursive: true });

  await dumpDatabaseToFile(sqlPath);

  const publicSrc = uploadConfig.directory;
  if (fs.existsSync(publicSrc)) {
    await fs.promises.cp(publicSrc, tempPublic, { recursive: true });
  } else {
    await fs.promises.mkdir(tempPublic, { recursive: true });
  }
  /** Garante entrada public/ no ZIP mesmo quando a pasta de origem está vazia. */
  const publicRootMarker = path.join(tempPublic, ".coreflow-backup-public-root");
  if (!fs.existsSync(publicRootMarker)) {
    await fs.promises.writeFile(publicRootMarker, "coreflow-backup-public-root\n", "utf8");
  }

  const manifest = buildManifest(backupSource);
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${BACKUP_FILENAME_PREFIX}${stamp}.zip`;
  const destZip = path.join(getBackupsRoot(), fileName);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(destZip);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));
    archive.pipe(output);
    archive.file(manifestPath, { name: "manifest.json" });
    archive.file(sqlPath, { name: "database.sql" });
    archive.directory(tempPublic, "public");
    archive.finalize();
  });

  await fs.promises.rm(tempRoot, { recursive: true, force: true });

  const st = await fs.promises.stat(destZip);
  return {
    fileName,
    absolutePath: destZip,
    manifest,
    sizeBytes: st.size
  };
}
