import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase 8.4-F (F3) — regularização histórica de faturas SaaS.
 *
 * Aditiva e idempotente:
 * - cria `SaaSInvoiceHistoricalReviews` (decisões por fatura, auditadas);
 * - índice único parcial: no máximo UMA decisão terminal por fatura (`keep_pending` pode repetir);
 * - `SaaSPayments.paidAt` passa a aceitar NULL (pagamento histórico com data desconhecida).
 *   Relaxamento compatível: o código antigo sempre grava paidAt.
 *
 * Nenhum dado existente é alterado.
 */
const TABLE = "SaaSInvoiceHistoricalReviews";

async function tableExists(queryInterface: QueryInterface, name: string) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = :name`,
    { replacements: { name } }
  );
  return (rows as unknown[]).length > 0;
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    if (!(await tableExists(queryInterface, TABLE))) {
      await queryInterface.createTable(TABLE, {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        invoiceId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Invoices", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        decision: {
          type: DataTypes.STRING(32),
          allowNull: false
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        confirmationSource: {
          type: DataTypes.STRING,
          allowNull: true
        },
        paidAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        paidAtUnknown: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true
        },
        method: {
          type: DataTypes.STRING(32),
          allowNull: true
        },
        paymentId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "SaaSPayments", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        actorUserId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        metadata: {
          type: DataTypes.JSONB,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "saas_hist_reviews_company_idx"
      ON "${TABLE}" ("companyId")
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "saas_hist_reviews_invoice_idx"
      ON "${TABLE}" ("invoiceId")
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "saas_hist_reviews_terminal_unique"
      ON "${TABLE}" ("invoiceId")
      WHERE "decision" <> 'keep_pending'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "SaaSPayments" ALTER COLUMN "paidAt" DROP NOT NULL
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    // Checa ANTES de qualquer alteração: se falhar, nada é desfeito pela metade.
    const [rows] = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int AS "n" FROM "SaaSPayments" WHERE "paidAt" IS NULL`
    );
    const nulls = Number((rows as Array<{ n: number }>)[0]?.n || 0);
    if (nulls > 0) {
      throw new Error(
        `Rollback recusado: ${nulls} pagamento(s) em "SaaSPayments" sem data (paidAt NULL, ` +
          `pagamentos históricos com data desconhecida). Restaurar NOT NULL exigiria inventar datas. ` +
          `Trate esses registros manualmente antes de desfazer esta migration.`
      );
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE "SaaSPayments" ALTER COLUMN "paidAt" SET NOT NULL
    `);

    if (await tableExists(queryInterface, TABLE)) {
      await queryInterface.dropTable(TABLE);
    }
  }
};
