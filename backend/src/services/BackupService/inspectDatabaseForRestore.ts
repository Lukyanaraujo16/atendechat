import { execMysqlScalar, execPsqlScalar, getDbEnv } from "./backupDbEnv";

/** Tabelas usadas para decidir se a base “já foi usada” pela aplicação. */
export const RESTORE_CRITICAL_TABLES = [
  "Users",
  "Companies",
  "Contacts",
  "Tickets",
  "Messages",
  "Whatsapps",
  "SystemSettings"
] as const;

export type CriticalTableSnapshot = {
  name: string;
  exists: boolean;
  rowCount: number;
};

export type DatabaseRestoreInspection = {
  databaseLooksEmpty: boolean;
  existingTablesCount: number;
  existingCriticalTables: CriticalTableSnapshot[];
  requiresStrongConfirmation: boolean;
};

function quoteMysqlIdent(name: string): string {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

function quotePgIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function listMysqlTableNames(): Promise<string[]> {
  const out = await execMysqlScalar(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name;"
  );
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function listPostgresTableNames(): Promise<string[]> {
  const out = await execPsqlScalar(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
  );
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function mysqlTableExists(tableName: string): Promise<boolean> {
  const out = await execMysqlScalar(
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '${tableName.replace(/'/g, "''")}';`
  );
  return parseInt(out.trim(), 10) > 0;
}

async function postgresTableExists(tableName: string): Promise<boolean> {
  const q = tableName.replace(/'/g, "''");
  const out = await execPsqlScalar(
    `SELECT COUNT(*)::text FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${q}';`
  );
  return parseInt(out.trim(), 10) > 0;
}

async function mysqlRowCount(tableName: string): Promise<number> {
  const out = await execMysqlScalar(`SELECT COUNT(*) FROM ${quoteMysqlIdent(tableName)};`);
  const n = parseInt(out.trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

async function postgresRowCount(tableName: string): Promise<number> {
  const out = await execPsqlScalar(`SELECT COUNT(*)::text FROM public.${quotePgIdent(tableName)};`);
  const n = parseInt(out.trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Inspeciona a BD atual antes do restore (sem alterar dados).
 */
export async function inspectDatabaseForRestore(): Promise<DatabaseRestoreInspection> {
  const env = getDbEnv();
  const dialect = env.dialect;
  const isPg = dialect === "postgres" || dialect === "postgresql";

  let existingTablesCount = 0;
  try {
    const names = isPg ? await listPostgresTableNames() : await listMysqlTableNames();
    existingTablesCount = names.length;
  } catch {
    existingTablesCount = 0;
  }

  const existingCriticalTables: CriticalTableSnapshot[] = [];

  for (const name of RESTORE_CRITICAL_TABLES) {
    let exists = false;
    let rowCount = 0;
    try {
      exists = isPg ? await postgresTableExists(name) : await mysqlTableExists(name);
      if (exists) {
        rowCount = isPg ? await postgresRowCount(name) : await mysqlRowCount(name);
      }
    } catch {
      exists = false;
      rowCount = 0;
    }
    existingCriticalTables.push({ name, exists, rowCount });
  }

  const hasRelevantData = existingCriticalTables.some((t) => t.exists && t.rowCount > 0);
  const databaseLooksEmpty = !hasRelevantData;

  return {
    databaseLooksEmpty,
    existingTablesCount,
    existingCriticalTables,
    requiresStrongConfirmation: !databaseLooksEmpty
  };
}
