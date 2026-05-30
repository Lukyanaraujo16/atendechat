import fs from "fs";
import path from "path";
import archiver from "archiver";
import { createWriteStream } from "fs";
import uploadConfig from "../../config/upload";
import {
  getBackupsRoot,
  BACKUP_FILENAME_PREFIX,
  BACKUP_ZLIB_LEVEL,
  ensureBackupDirs
} from "../../config/backup";
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

export type BackupProgressStep =
  | "dumping_database"
  | "copying_public"
  | "compressing"
  | "finalizing";

export interface BackupProgressUpdate {
  step: BackupProgressStep;
}

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
  onProgress?: (update: BackupProgressUpdate) => void;
}

function buildBackupFileNames(backupSource: BackupSource): {
  tempFileName: string;
  finalFileName: string;
  tempAbsolutePath: string;
  finalAbsolutePath: string;
} {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let base = `${BACKUP_FILENAME_PREFIX}${stamp}`;
  if (backupSource === "pre_restore") {
    base = `coreflow-backup-antes-restauro-${Date.now()}`;
  }
  const tempFileName = `${base}.zip.tmp`;
  const finalFileName = `${base}.zip`;
  const root = getBackupsRoot();
  return {
    tempFileName,
    finalFileName,
    tempAbsolutePath: path.join(root, tempFileName),
    finalAbsolutePath: path.join(root, finalFileName)
  };
}

/**
 * Gera ZIP em backups/ (primeiro .zip.tmp, renomeia para .zip ao concluir).
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
  const onProgress = options?.onProgress;
  ensureBackupDirs();

  const { tempFileName, finalFileName, tempAbsolutePath, finalAbsolutePath } =
    buildBackupFileNames(backupSource);

  const tempRoot = path.join(
    getBackupsRoot(),
    `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const tempPublic = path.join(tempRoot, "public");
  const sqlPath = path.join(tempRoot, "database.sql");
  const manifestPath = path.join(tempRoot, "manifest.json");

  try {
    await fs.promises.mkdir(tempRoot, { recursive: true });

    onProgress?.({ step: "dumping_database" });
    await dumpDatabaseToFile(sqlPath);

    onProgress?.({ step: "copying_public" });
    const publicSrc = uploadConfig.directory;
    if (fs.existsSync(publicSrc)) {
      await fs.promises.cp(publicSrc, tempPublic, { recursive: true });
    } else {
      await fs.promises.mkdir(tempPublic, { recursive: true });
    }
    const publicRootMarker = path.join(tempPublic, ".coreflow-backup-public-root");
    if (!fs.existsSync(publicRootMarker)) {
      await fs.promises.writeFile(publicRootMarker, "coreflow-backup-public-root\n", "utf8");
    }

    const manifest = buildManifest(backupSource);
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    onProgress?.({ step: "compressing" });
    await fs.promises.rm(tempAbsolutePath, { force: true }).catch(() => {});

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(tempAbsolutePath);
      const archive = archiver("zip", { zlib: { level: BACKUP_ZLIB_LEVEL } });
      output.on("close", () => resolve());
      output.on("error", (err) => reject(err));
      archive.on("error", (err) => reject(err));
      archive.pipe(output);
      archive.file(manifestPath, { name: "manifest.json" });
      archive.file(sqlPath, { name: "database.sql" });
      archive.directory(tempPublic, "public");
      archive.finalize();
    });

    onProgress?.({ step: "finalizing" });
    await fs.promises.rename(tempAbsolutePath, finalAbsolutePath);

    const st = await fs.promises.stat(finalAbsolutePath);
    return {
      fileName: finalFileName,
      absolutePath: finalAbsolutePath,
      manifest,
      sizeBytes: st.size
    };
  } catch (e) {
    await fs.promises.rm(tempAbsolutePath, { force: true }).catch(() => {});
    throw e;
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}
