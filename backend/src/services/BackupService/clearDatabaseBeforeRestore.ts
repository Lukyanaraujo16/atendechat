import {
  execMysqlScalar,
  execMysqlScript,
  execPsqlScalar,
  execPsqlScript,
  getDbEnv
} from "./backupDbEnv";

function quoteMysqlIdent(name: string): string {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

async function clearMysqlSchema(): Promise<void> {
  const viewsOut = await execMysqlScalar(
    "SELECT table_name FROM information_schema.views WHERE table_schema = DATABASE();"
  );
  const viewNames = viewsOut
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tablesOut = await execMysqlScalar(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';"
  );
  const tableNames = tablesOut
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const statements: string[] = ["SET FOREIGN_KEY_CHECKS=0;"];
  for (const v of viewNames) {
    statements.push(`DROP VIEW IF EXISTS ${quoteMysqlIdent(v)};`);
  }
  for (const t of tableNames) {
    statements.push(`DROP TABLE IF EXISTS ${quoteMysqlIdent(t)};`);
  }
  statements.push("SET FOREIGN_KEY_CHECKS=1;");
  await execMysqlScript(statements.join("\n"));
  console.log(
    `[restore] MySQL: removidas ${tableNames.length} tabela(s) e ${viewNames.length} view(s) antes do import.`
  );
}

async function clearPostgresSchema(): Promise<void> {
  const env = getDbEnv();
  const appRole = `"${String(env.user).replace(/"/g, '""')}"`;
  await execPsqlScript("DROP SCHEMA IF EXISTS public CASCADE;");
  await execPsqlScript("CREATE SCHEMA public;");
  await execPsqlScript("GRANT ALL ON SCHEMA public TO PUBLIC;");
  await execPsqlScript(`GRANT ALL ON SCHEMA public TO ${appRole};`);
  console.log("[restore] PostgreSQL: schema public recriado (DROP CASCADE + CREATE).");
}

/**
 * Remove todos os objetos da aplicação no schema atual (preserva a base DB_NAME).
 * Deve correr só após backup pre_restore e com confirmação forte do operador.
 */
export async function clearDatabaseBeforeRestore(): Promise<void> {
  const dialect = getDbEnv().dialect;
  if (dialect === "postgres" || dialect === "postgresql") {
    await clearPostgresSchema();
    return;
  }
  if (dialect === "mysql" || dialect === "mariadb") {
    await clearMysqlSchema();
    return;
  }
  throw new Error(`RESTORE_CLEAR_UNSUPPORTED_DIALECT:${dialect}`);
}
