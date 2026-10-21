import { QueryInterface, QueryTypes } from "sequelize";

/**
 * Fase 8.3-B3.2 — índice único parcial em SaaSPaymentAttempts.externalTxid (RF2.3a, R-15).
 *
 * Aditiva e idempotente (IF NOT EXISTS). Não altera nem apaga linhas: se já houver txid
 * repetido, a migration para com erro explícito em vez de "corrigir" dados financeiros —
 * a duplicidade precisa de análise humana antes (levantamento só leitura no relatório).
 * `down` remove só o índice; nenhuma linha é apagada (RNF4).
 * Campos novos da tentativa (fonte, configId, slot, ambiente, commit, expiresAt) ficam em
 * `payloadSummary` (JSONB), sem coluna nova.
 */
const INDEX = "saas_payment_attempts_external_txid_unique";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dup = await queryInterface.sequelize.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM (
         SELECT "externalTxid" FROM "SaaSPaymentAttempts"
         WHERE "externalTxid" IS NOT NULL
         GROUP BY "externalTxid" HAVING COUNT(*) > 1
       ) d`,
      { type: QueryTypes.SELECT }
    );
    const total = Number(dup[0]?.total || 0);
    if (total > 0) {
      throw new Error(
        `[${INDEX}] ${total} txid(s) repetidos em SaaSPaymentAttempts; ` +
          "analise e resolva antes de aplicar (nenhum dado foi alterado)."
      );
    }
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}"
       ON "SaaSPaymentAttempts" ("externalTxid")
       WHERE "externalTxid" IS NOT NULL`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${INDEX}"`);
  }
};
