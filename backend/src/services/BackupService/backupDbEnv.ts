import { spawn } from "child_process";

export function getDbEnv(): {
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

export async function execMysqlScript(sql: string): Promise<void> {
  const env = getDbEnv();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "mysql",
      ["-h", env.host, "-P", env.port, "-u", env.user, env.database],
      {
        env: { ...process.env, MYSQL_PWD: env.password },
        stdio: ["pipe", "pipe", "pipe"]
      }
    );
    let errBuf = "";
    child.stderr?.on("data", (c: Buffer) => {
      errBuf += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysql script failed (${code}): ${errBuf}`));
    });
    child.stdin.write(sql);
    child.stdin.end();
  });
}

export async function execMysqlScalar(sql: string): Promise<string> {
  const env = getDbEnv();
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
      else reject(new Error(`mysql scalar failed: ${errBuf}`));
    });
  });
}

export async function execPsqlScalar(sql: string): Promise<string> {
  const env = getDbEnv();
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
      else reject(new Error(`psql scalar failed: ${errBuf}`));
    });
  });
}

export async function execPsqlScript(sql: string): Promise<void> {
  const env = getDbEnv();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "psql",
      [
        "-h",
        env.host,
        "-p",
        env.port,
        "-U",
        env.user,
        "-d",
        env.database,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql
      ],
      {
        env: { ...process.env, PGPASSWORD: env.password },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let errBuf = "";
    child.stderr?.on("data", (c: Buffer) => {
      errBuf += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql script failed: ${errBuf}`));
    });
  });
}
