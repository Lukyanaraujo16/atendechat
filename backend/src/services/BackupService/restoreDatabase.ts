import { spawn } from "child_process";
import fs, { createReadStream } from "fs";
import path from "path";
import { pipeline } from "stream/promises";

/** Raiz do backend (onde está .sequelizerc) — dist/services/BackupService → ../../../ */
function getBackendRootForCli(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

function getEnv(): {
  dialect: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
} {
  return {
    dialect: (process.env.DB_DIALECT || "mysql").toLowerCase(),
    host: process.env.DB_HOST || "127.0.0.1",
    port: String(process.env.DB_PORT || "3306"),
    database: process.env.DB_NAME || "",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASS || ""
  };
}

/**
 * Credenciais só para `psql` ao importar um dump (restauro).
 * O dump pode incluir DROP/CREATE EXTENSION (ex.: uuid-ossp); o utilizador da app
 * muitas vezes não é dono da extensão → erro "must be owner of extension".
 * Defina DB_IMPORT_USER=postgres e DB_IMPORT_PASS no .env do servidor.
 */
function getPsqlImportCredentials(): { user: string; password: string } {
  const base = getEnv();
  const user = (process.env.DB_IMPORT_USER || "").trim() || base.user;
  const password =
    process.env.DB_IMPORT_PASS !== undefined
      ? process.env.DB_IMPORT_PASS
      : base.password;
  return { user, password };
}

export async function restoreMysqlFromSqlFile(sqlPath: string): Promise<void> {
  const env = getEnv();
  let errBuf = "";
  const child = spawn(
    "mysql",
    ["-h", env.host, "-P", env.port, "-u", env.user, env.database],
    {
      env: { ...process.env, MYSQL_PWD: env.password },
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  child.stderr?.on("data", (c: Buffer) => {
    errBuf += c.toString();
  });
  const exitPromise = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysql import failed (${code}): ${errBuf}`));
    });
  });
  try {
    await pipeline(createReadStream(sqlPath), child.stdin);
  } catch (e) {
    child.kill("SIGKILL");
    throw e;
  }
  await exitPromise;
}

export async function restorePostgresFromSqlFile(sqlPath: string): Promise<void> {
  const env = getEnv();
  const cred = getPsqlImportCredentials();
  if (cred.user !== env.user) {
    console.log(
      `[restore] psql import a usar DB_IMPORT_USER (${cred.user}) em vez de DB_USER (${env.user})`
    );
  }
  let errBuf = "";
  const child = spawn(
    "psql",
    [
      "-h",
      env.host,
      "-p",
      env.port,
      "-U",
      cred.user,
      "-d",
      env.database,
      "-v",
      "ON_ERROR_STOP=1"
    ],
    {
      env: { ...process.env, PGPASSWORD: cred.password },
      stdio: ["pipe", "pipe", "pipe"]
    }
  );
  child.stderr?.on("data", (c: Buffer) => {
    errBuf += c.toString();
  });
  const exitPromise = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql import failed (${code}): ${errBuf}`));
    });
  });
  try {
    await pipeline(createReadStream(sqlPath), child.stdin);
  } catch (e) {
    child.kill("SIGKILL");
    throw e;
  }
  await exitPromise;
}

/** Aspas para identificadores PostgreSQL (nomes de roles/tabelas). */
function pgQuoteIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

/**
 * Depois de importar o SQL como superuser (DB_IMPORT_*), tabelas/sequências podem ficar
 * com owner `postgres` → `sequelize db:migrate` como DB_USER falha com
 * "permission denied for table SequelizeMeta". Concede privilégios ao utilizador da app.
 */
export async function grantPostgresAppUserAfterSuperuserImport(): Promise<void> {
  const env = getEnv();
  const d = env.dialect;
  if (d !== "postgres" && d !== "postgresql") return;

  const cred = getPsqlImportCredentials();
  if (cred.user === env.user) {
    console.log(
      "[restore] Import com o mesmo utilizador que DB_USER — sem GRANT extra (owner já alinhado)."
    );
    return;
  }

  const appRole = pgQuoteIdent(env.user);
  const sql = [
    "SET client_min_messages TO WARNING;",
    `GRANT USAGE ON SCHEMA public TO ${appRole};`,
    `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${appRole};`,
    `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${appRole};`,
    `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${appRole};`
  ].join("\n");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "psql",
      [
        "-h",
        env.host,
        "-p",
        env.port,
        "-U",
        cred.user,
        "-d",
        env.database,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql
      ],
      {
        env: { ...process.env, PGPASSWORD: cred.password },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let errBuf = "";
    let outBuf = "";
    child.stdout?.on("data", (c: Buffer) => {
      outBuf += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      errBuf += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        console.log(
          "[restore] Privilégios em public concedidos a DB_USER para migrations (SequelizeMeta, etc.)."
        );
        resolve();
      } else {
        reject(
          new Error(
            `RESTORE_GRANT_FAILED: não foi possível conceder privilégios ao utilizador da app após o import (código ${code}). ${errBuf}\n${outBuf}`
          )
        );
      }
    });
  });
}

function resolveSequelizeCliEntry(backendRoot: string): string {
  const pkgPath = path.join(backendRoot, "node_modules", "sequelize-cli", "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
        bin?: { sequelize?: string };
      };
      const rel = (pkg.bin?.sequelize || "./lib/sequelize").replace(/^\.\//, "");
      const abs = path.join(path.dirname(pkgPath), rel);
      if (fs.existsSync(abs)) return abs;
    } catch {
      /* continuar com candidatos */
    }
  }
  const candidates = [
    path.join(backendRoot, "node_modules", "sequelize-cli", "lib", "sequelize.js"),
    path.join(backendRoot, "node_modules", "sequelize-cli", "lib", "sequelize")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "RESTORE_MIGRATE_FAILED: sequelize-cli não encontrado em node_modules. No servidor: cd backend && npm install"
  );
}

/**
 * Após importar o SQL, aplica migrations pendentes (ex.: tabelas novas vs backup antigo).
 * Usa o mesmo binário Node do processo e o sequelize-cli local — evita depender de `npx` no PATH
 * (systemd costuma não incluir /usr/bin completo e o restauro falhava com 500).
 */
export async function runSequelizeDbMigrateAfterRestore(): Promise<void> {
  const root = getBackendRootForCli();
  const cliEntry = resolveSequelizeCliEntry(root);
  const nodeBin = process.execPath;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(nodeBin, [cliEntry, "db:migrate"], {
      cwd: root,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let errBuf = "";
    let outBuf = "";
    child.stdout?.on("data", (c: Buffer) => {
      outBuf += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      errBuf += c.toString();
    });
    child.on("error", (e) => {
      reject(
        new Error(
          `RESTORE_MIGRATE_FAILED: não foi possível executar migrations (${(e as Error).message}). Verifique Node e sequelize-cli em ${root}.`
        )
      );
    });
    child.on("close", (code) => {
      const log = `${outBuf}${errBuf}`.trim();
      if (log) {
        console.log("[restore] sequelize db:migrate:\n", log.slice(0, 4000));
      }
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `RESTORE_MIGRATE_FAILED: sequelize db:migrate saiu com código ${code}. ${errBuf}\n${outBuf}`
          )
        );
      }
    });
  });
}

async function execPsqlScalar(
  env: ReturnType<typeof getEnv>,
  sql: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "psql",
      ["-h", env.host, "-p", env.port, "-U", env.user, "-d", env.database, "-t", "-A", "-c", sql],
      {
        env: { ...process.env, PGPASSWORD: env.password },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let out = "";
    let errBuf = "";
    child.stdout?.on("data", (c: Buffer) => {
      out += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      errBuf += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`psql (verificação): ${errBuf}`));
    });
  });
}

async function execMysqlScalar(
  env: ReturnType<typeof getEnv>,
  sql: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "mysql",
      ["-h", env.host, "-P", env.port, "-u", env.user, "-N", "-B", "-e", sql, env.database],
      {
        env: { ...process.env, MYSQL_PWD: env.password },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let out = "";
    let errBuf = "";
    child.stdout?.on("data", (c: Buffer) => {
      out += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      errBuf += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`mysql (verificação): ${errBuf}`));
    });
  });
}

/**
 * Garante que o schema mínimo existe (evita API 500 após restauro).
 */
export async function verifyRestoredSchemaCoreTables(): Promise<void> {
  const env = getEnv();
  const d = env.dialect;
  if (d === "postgres" || d === "postgresql") {
    const sql = `SELECT (
  CASE WHEN to_regclass('public."Users"') IS NOT NULL THEN 1 ELSE 0 END +
  CASE WHEN to_regclass('public."Companies"') IS NOT NULL THEN 1 ELSE 0 END +
  CASE WHEN to_regclass('public."SystemSettings"') IS NOT NULL THEN 1 ELSE 0 END
)::text;`;
    const out = await execPsqlScalar(env, sql);
    const n = parseInt(out.trim(), 10);
    if (Number.isNaN(n) || n !== 3) {
      throw new Error(
        `RESTORE_SCHEMA_INCOMPLETE: faltam tabelas core (Users/Companies/SystemSettings). Encontradas ${Number.isNaN(n) ? "?" : n}/3. Restaure o ZIP de pré-restauração (pasta backups) ou use uma base limpa com db:migrate.`
      );
    }
    return;
  }
  if (d === "mysql" || d === "mariadb") {
    const sql =
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('Users','Companies','SystemSettings');";
    const out = await execMysqlScalar(env, sql);
    const n = parseInt(out.trim(), 10);
    if (Number.isNaN(n) || n !== 3) {
      throw new Error(
        `RESTORE_SCHEMA_INCOMPLETE: faltam tabelas core (Users/Companies/SystemSettings). Encontradas ${Number.isNaN(n) ? "?" : n}/3.`
      );
    }
  }
}
