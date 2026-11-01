import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Exclusão definitiva de empresas — acompanhamento assíncrono e arquivo financeiro restrito.
 *
 * Sem FK para Companies de propósito: os registros sobrevivem à exclusão da empresa
 * (auditoria e retenção legal). Aditiva e idempotente.
 * - CompanyDeletions: uma operação por empresa (índice único parcial impede duplicidade).
 * - CompanyDeletionArchives: cópia restrita dos registros financeiros da plataforma
 *   (faturas, pagamentos, assinaturas) mantida por obrigação legal; sem exposição em API.
 */
const JOBS = "CompanyDeletions";
const ARCHIVES = "CompanyDeletionArchives";

async function tableExists(
  qi: QueryInterface,
  table: string
): Promise<boolean> {
  const rows = await qi.sequelize.query<{ reg: string | null }>(
    `SELECT to_regclass('public."${table}"')::text AS reg`,
    { type: QueryTypes.SELECT }
  );
  return Boolean(rows[0]?.reg);
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    if (!(await tableExists(queryInterface, JOBS))) {
      await queryInterface.createTable(JOBS, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        companyId: { type: DataTypes.INTEGER, allowNull: false },
        companyName: { type: DataTypes.STRING, allowNull: true },
        requestedBy: { type: DataTypes.INTEGER, allowNull: true },
        /** pending | running | failed | completed */
        status: { type: DataTypes.STRING(16), allowNull: false },
        /** integrations | files_inventory | archive | database | files | done */
        phase: { type: DataTypes.STRING(32), allowNull: false },
        attempts: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        /** Arquivos físicos a remover (caminhos relativos a public/), definidos antes do banco. */
        filePaths: { type: DataTypes.JSONB, allowNull: true },
        stats: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        lastError: { type: DataTypes.TEXT, allowNull: true },
        startedAt: { type: DataTypes.DATE, allowNull: true },
        finishedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }
    if (!(await tableExists(queryInterface, ARCHIVES))) {
      await queryInterface.createTable(ARCHIVES, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        deletionId: { type: DataTypes.INTEGER, allowNull: false },
        companyId: { type: DataTypes.INTEGER, allowNull: false },
        tableName: { type: DataTypes.STRING(64), allowNull: false },
        rowCount: { type: DataTypes.INTEGER, allowNull: false },
        rows: { type: DataTypes.JSONB, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false }
      });
    }
    const q = (sql: string) => queryInterface.sequelize.query(sql);
    await q(
      `CREATE UNIQUE INDEX IF NOT EXISTS "company_deletions_open_unique" ON "${JOBS}" ("companyId") WHERE "status" IN ('pending', 'running', 'failed')`
    );
    await q(
      `CREATE UNIQUE INDEX IF NOT EXISTS "company_deletion_archives_table_unique" ON "${ARCHIVES}" ("deletionId", "tableName")`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    // Só remove o acompanhamento; o arquivo financeiro é preservado por obrigação legal.
    if (await tableExists(queryInterface, JOBS)) {
      await queryInterface.dropTable(JOBS);
    }
  }
};
