import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Monitoramento Evolution — amostras de infraestrutura enviadas pelo coletor da VPS Evolution.
 *
 * Aditiva e idempotente: cria a tabela e os índices só se não existirem.
 * Retenção controlada pelo job evolutionMetricsRetentionScheduler (7 dias).
 * `down` remove a tabela: contém apenas métricas operacionais descartáveis.
 */
const TABLE = "EvolutionMetricSamples";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const exists = await queryInterface.sequelize.query<{ reg: string | null }>(
      `SELECT to_regclass('public."${TABLE}"')::text AS reg`,
      { type: QueryTypes.SELECT }
    );
    if (!exists[0]?.reg) {
      await queryInterface.createTable(TABLE, {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        /** Identificador do host informado pelo coletor (ex.: hostname da VPS Evolution). */
        source: { type: DataTypes.STRING(64), allowNull: false },
        collectedAt: { type: DataTypes.DATE, allowNull: false },
        hostCpuPercent: { type: DataTypes.DOUBLE, allowNull: false },
        hostCpuCores: { type: DataTypes.INTEGER, allowNull: false },
        hostMemTotalBytes: { type: DataTypes.BIGINT, allowNull: false },
        hostMemUsedBytes: { type: DataTypes.BIGINT, allowNull: false },
        hostMemAvailableBytes: { type: DataTypes.BIGINT, allowNull: false },
        hostDiskTotalBytes: { type: DataTypes.BIGINT, allowNull: false },
        hostDiskUsedBytes: { type: DataTypes.BIGINT, allowNull: false },
        hostDiskAvailableBytes: { type: DataTypes.BIGINT, allowNull: false },
        hostLoad1: { type: DataTypes.DOUBLE, allowNull: false },
        hostLoad5: { type: DataTypes.DOUBLE, allowNull: false },
        hostLoad15: { type: DataTypes.DOUBLE, allowNull: false },
        hostBootAt: { type: DataTypes.DATE, allowNull: false },
        /** Consumo do contêiner Evolution API (desnormalizado para as séries históricas). */
        apiCpuPercent: { type: DataTypes.DOUBLE, allowNull: true },
        apiMemBytes: { type: DataTypes.BIGINT, allowNull: true },
        /** Estado por contêiner (api, postgres, redis), já validado na ingestão. */
        containers: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: []
        },
        createdAt: { type: DataTypes.DATE, allowNull: false }
      });
    }
    const q = (sql: string) => queryInterface.sequelize.query(sql);
    await q(
      `CREATE UNIQUE INDEX IF NOT EXISTS "evolution_metric_samples_source_collected_unique" ON "${TABLE}" ("source", "collectedAt")`
    );
    await q(
      `CREATE INDEX IF NOT EXISTS "evolution_metric_samples_collected_idx" ON "${TABLE}" ("collectedAt")`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${TABLE}"`);
  }
};
