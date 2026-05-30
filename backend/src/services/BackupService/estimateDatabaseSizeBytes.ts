import { QueryTypes } from "sequelize";
import sequelize from "../../database";

/**
 * Tamanho lógico da base (metadados). PostgreSQL: pg_database_size; MySQL: information_schema.
 */
export async function estimateDatabaseSizeBytes(): Promise<number> {
  const dialect = sequelize.getDialect();

  if (dialect === "postgres") {
    const rows = (await sequelize.query<{ size_bytes: string }>(
      `SELECT pg_database_size(current_database())::bigint AS size_bytes`,
      { type: QueryTypes.SELECT }
    )) as { size_bytes: string }[];
    const raw = rows[0]?.size_bytes;
    const n = raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("BACKUP_DISK_SPACE_ESTIMATE_FAILED:database_size");
    }
    return n;
  }

  if (dialect === "mysql" || dialect === "mariadb") {
    const dbName = process.env.DB_NAME || "";
    const rows = (await sequelize.query<{ total_bytes: string }>(
      `SELECT COALESCE(SUM(data_length + index_length), 0) AS total_bytes
       FROM information_schema.TABLES
       WHERE table_schema = :schema`,
      {
        type: QueryTypes.SELECT,
        replacements: { schema: dbName }
      }
    )) as { total_bytes: string }[];
    const raw = rows[0]?.total_bytes;
    const n = raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("BACKUP_DISK_SPACE_ESTIMATE_FAILED:database_size");
    }
    return n;
  }

  throw new Error(`BACKUP_DISK_SPACE_ESTIMATE_FAILED:dialect_${dialect}`);
}
