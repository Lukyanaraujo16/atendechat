/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes, QueryTypes } from "sequelize";
import { planInventorySalePaymentBackfill } from "../../services/InventoryService/inventorySalePaymentBackfill";

/**
 * P1 — Fundação pagamentos 1:N:
 * - cria InventorySalePayments (tenant-safe, FK composta)
 * - backfill conservador a partir dos campos legados da sale
 * - NÃO altera InventorySales
 *
 * ON DELETE CASCADE Sale→Payment: permite exclusão física de draft
 * (mesmo padrão de InventorySaleDeliveries). Vendas concluídas usam
 * cancelamento lógico, não hard delete.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    return sequelize.transaction(async transaction => {
      await sequelize.query(
        `
          CREATE UNIQUE INDEX IF NOT EXISTS "InventorySales_id_companyId_unique"
          ON "InventorySales" ("id", "companyId");
        `,
        { transaction }
      );

      await queryInterface.createTable(
        "InventorySalePayments",
        {
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
          saleId: {
            type: DataTypes.INTEGER,
            allowNull: false
          },
          method: {
            type: DataTypes.STRING(32),
            allowNull: false
          },
          amount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
          },
          status: {
            type: DataTypes.STRING(16),
            allowNull: false
          },
          paidAt: {
            type: DataTypes.DATE,
            allowNull: true
          },
          notes: {
            type: DataTypes.TEXT,
            allowNull: true
          },
          cardInstallmentCount: {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          createdByUserId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
          }
        },
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventorySalePayments"
          ADD CONSTRAINT "InventorySalePayments_sale_company_fk"
          FOREIGN KEY ("saleId", "companyId")
          REFERENCES "InventorySales" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE CASCADE;
        `,
        { transaction }
      );

      await queryInterface.addIndex(
        "InventorySalePayments",
        ["companyId", "saleId"],
        { name: "InventorySalePayments_company_sale_idx", transaction }
      );
      await queryInterface.addIndex(
        "InventorySalePayments",
        ["saleId", "status"],
        { name: "InventorySalePayments_sale_status_idx", transaction }
      );
      await queryInterface.addIndex(
        "InventorySalePayments",
        ["companyId", "paidAt"],
        { name: "InventorySalePayments_company_paidAt_idx", transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventorySalePayments"
          ADD CONSTRAINT "InventorySalePayments_amount_positive_chk"
          CHECK (amount > 0);
        `,
        { transaction }
      );
      await sequelize.query(
        `
          ALTER TABLE "InventorySalePayments"
          ADD CONSTRAINT "InventorySalePayments_status_chk"
          CHECK (status IN ('pending', 'paid', 'reversed'));
        `,
        { transaction }
      );

      const sales = await sequelize.query(
        `
          SELECT
            id,
            "companyId",
            "paymentStatus",
            "paymentMethod",
            "paidAmount",
            "totalAmount",
            "paidAt",
            "paymentNotes",
            "cardInstallmentCount",
            "createdAt",
            "updatedAt"
          FROM "InventorySales"
          ORDER BY id ASC
        `,
        { type: QueryTypes.SELECT, transaction }
      );

      const skipCounts: Record<string, number> = {};
      let created = 0;

      for (const row of sales as Array<Record<string, unknown>>) {
        const plan = planInventorySalePaymentBackfill({
          id: Number(row.id),
          companyId: Number(row.companyId),
          paymentStatus: row.paymentStatus as string,
          paymentMethod: row.paymentMethod as string | null,
          paidAmount: row.paidAmount as string | number | null,
          totalAmount: row.totalAmount as string | number | null,
          paidAt: (row.paidAt as Date | string | null) ?? null,
          paymentNotes: (row.paymentNotes as string | null) ?? null,
          cardInstallmentCount:
            row.cardInstallmentCount == null
              ? null
              : Number(row.cardInstallmentCount),
          createdAt: (row.createdAt as Date | string | null) ?? null,
          updatedAt: (row.updatedAt as Date | string | null) ?? null
        });

        if (plan.action === "skip") {
          skipCounts[plan.reason] = (skipCounts[plan.reason] || 0) + 1;
          continue;
        }

        const p = plan.payment;
        await sequelize.query(
          `
            INSERT INTO "InventorySalePayments"
              ("companyId", "saleId", "method", "amount", "status", "paidAt",
               "notes", "cardInstallmentCount", "createdByUserId", "createdAt", "updatedAt")
            SELECT
              :companyId, :saleId, :method, :amount, :status, :paidAt,
              :notes, :cardInstallmentCount, NULL, :createdAt, :updatedAt
            WHERE NOT EXISTS (
              SELECT 1 FROM "InventorySalePayments" isp
              WHERE isp."saleId" = :saleId AND isp."companyId" = :companyId
            )
          `,
          {
            transaction,
            replacements: {
              companyId: p.companyId,
              saleId: p.saleId,
              method: p.method,
              amount: p.amount,
              status: p.status,
              paidAt: p.paidAt,
              notes: p.notes,
              cardInstallmentCount: p.cardInstallmentCount,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt
            }
          }
        );
        created += 1;
      }

      // eslint-disable-next-line no-console
      console.log(
        `[inventory-sale-payments-p1] backfill created=${created} skips=${JSON.stringify(
          skipCounts
        )}`
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Remove só a estrutura P1. Não altera InventorySales nem o unique (id, companyId)
    // reutilizado por InventorySaleDeliveries.
    await queryInterface.dropTable("InventorySalePayments");
  }
};
