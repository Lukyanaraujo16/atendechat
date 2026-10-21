import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Fase 8.3-B3.3 — fonte durável das notificações Pix da Efí (D-P9, D-P18, RF3.3).
 *
 * Aditiva e idempotente: cria a tabela e os índices só se não existirem. Não altera
 * nenhuma tabela financeira existente. Payload mínimo (R-31): sem dados do pagador,
 * cabeçalhos ou query.
 * `down` só remove a tabela se estiver vazia; com eventos gravados, para com erro
 * explícito (RNF4: nenhum dado financeiro é apagado por rollback de migration).
 */
const TABLE = "SaaSGatewayWebhookEvents";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const exists = await queryInterface.sequelize.query<{ reg: string | null }>(
      `SELECT to_regclass('public."${TABLE}"')::text AS reg`,
      { type: QueryTypes.SELECT }
    );
    if (!exists[0]?.reg) {
      await queryInterface.createTable(TABLE, {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        provider: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "efi" },
        /** pix:<e2eId> · devolucao:<e2eId>:<id>:<status> · teste:<hash> · invalido:<hash> (R-23). */
        eventKey: { type: DataTypes.STRING(200), allowNull: false },
        /** pix | devolucao | teste | invalido */
        eventType: { type: DataTypes.STRING(16), allowNull: false },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "received" },
        txid: { type: DataTypes.STRING(35), allowNull: true },
        endToEndId: { type: DataTypes.STRING(64), allowNull: true },
        devolucaoId: { type: DataTypes.STRING(64), allowNull: true },
        amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        invoiceId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Invoices", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        paymentId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "SaaSPayments", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        reconciliationItemId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "SaaSReconciliationItems", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        /** Fonte de credencial que autenticou a recepção (legacy_env | database). */
        credentialsSource: { type: DataTypes.STRING(16), allowNull: true },
        payload: { type: DataTypes.JSONB, allowNull: true },
        result: { type: DataTypes.JSONB, allowNull: true },
        attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        lockedBy: { type: DataTypes.STRING(128), allowNull: true },
        lockedAt: { type: DataTypes.DATE, allowNull: true },
        lastError: { type: DataTypes.TEXT, allowNull: true },
        /** A5: cada tentativa (horário, worker, resultado, erro sanitizado); últimas N. */
        attemptLog: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        /** Ações do Super Admin (reprocessar, classificar), com nota e ator. */
        adminActions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        processedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }
    const q = (sql: string) => queryInterface.sequelize.query(sql);
    await q(
      `CREATE UNIQUE INDEX IF NOT EXISTS "saas_gw_webhook_events_event_key_unique" ON "${TABLE}" ("eventKey")`
    );
    await q(
      `CREATE INDEX IF NOT EXISTS "saas_gw_webhook_events_status_next_idx" ON "${TABLE}" ("status", "nextAttemptAt")`
    );
    await q(`CREATE INDEX IF NOT EXISTS "saas_gw_webhook_events_txid_idx" ON "${TABLE}" ("txid")`);
    await q(
      `CREATE INDEX IF NOT EXISTS "saas_gw_webhook_events_e2e_idx" ON "${TABLE}" ("endToEndId")`
    );
    await q(
      `CREATE INDEX IF NOT EXISTS "saas_gw_webhook_events_company_idx" ON "${TABLE}" ("companyId")`
    );
    await q(
      `CREATE INDEX IF NOT EXISTS "saas_gw_webhook_events_invoice_idx" ON "${TABLE}" ("invoiceId")`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    const exists = await queryInterface.sequelize.query<{ reg: string | null }>(
      `SELECT to_regclass('public."${TABLE}"')::text AS reg`,
      { type: QueryTypes.SELECT }
    );
    if (!exists[0]?.reg) return;
    const rows = await queryInterface.sequelize.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM "${TABLE}"`,
      { type: QueryTypes.SELECT }
    );
    if (Number(rows[0]?.total || 0) > 0) {
      throw new Error(
        `[${TABLE}] down recusado: a tabela tem eventos gravados (dados financeiros não são apagados).`
      );
    }
    await queryInterface.dropTable(TABLE);
  }
};
