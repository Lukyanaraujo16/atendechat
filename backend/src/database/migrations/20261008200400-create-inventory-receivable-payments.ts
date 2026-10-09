/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    return sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "InventoryReceivablePayments",
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
          receivableId: {
            type: DataTypes.INTEGER,
            allowNull: false
          },
          installmentId: {
            type: DataTypes.INTEGER,
            allowNull: false
          },
          amount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
          },
          paymentMethod: {
            type: DataTypes.STRING(32),
            allowNull: false
          },
          paidAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          notes: {
            type: DataTypes.TEXT,
            allowNull: true
          },
          createdByUserId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
          },
          reversedAt: {
            type: DataTypes.DATE,
            allowNull: true
          },
          reversedByUserId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL"
          },
          reverseOfPaymentId: {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          reverseReason: {
            type: DataTypes.TEXT,
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
        },
        { transaction }
      );

      await sequelize.query(
        `
          CREATE UNIQUE INDEX IF NOT EXISTS "InventoryReceivablePayments_id_companyId_unique"
          ON "InventoryReceivablePayments" ("id", "companyId");
        `,
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivablePayments"
          ADD CONSTRAINT "InventoryReceivablePayments_receivable_company_fk"
          FOREIGN KEY ("receivableId", "companyId")
          REFERENCES "InventoryReceivables" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE RESTRICT;
        `,
        { transaction }
      );

      // Impede installment de receivable A + payment apontando receivable B.
      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivablePayments"
          ADD CONSTRAINT "InventoryReceivablePayments_installment_recv_company_fk"
          FOREIGN KEY ("installmentId", "receivableId", "companyId")
          REFERENCES "InventoryReceivableInstallments" ("id", "receivableId", "companyId")
          ON UPDATE CASCADE
          ON DELETE RESTRICT;
        `,
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivablePayments"
          ADD CONSTRAINT "InventoryReceivablePayments_reverseOf_company_fk"
          FOREIGN KEY ("reverseOfPaymentId", "companyId")
          REFERENCES "InventoryReceivablePayments" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE SET NULL;
        `,
        { transaction }
      );

      await queryInterface.addIndex(
        "InventoryReceivablePayments",
        ["companyId", "receivableId", "paidAt"],
        {
          name: "InventoryReceivablePayments_company_recv_paidAt_idx",
          transaction
        }
      );
      await queryInterface.addIndex(
        "InventoryReceivablePayments",
        ["companyId", "installmentId"],
        {
          name: "InventoryReceivablePayments_company_installment_idx",
          transaction
        }
      );
      await queryInterface.addIndex(
        "InventoryReceivablePayments",
        ["companyId", "paidAt"],
        {
          name: "InventoryReceivablePayments_company_paidAt_idx",
          transaction
        }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivablePayments"
          ADD CONSTRAINT "InventoryReceivablePayments_amount_nonzero_chk"
          CHECK (amount <> 0);
        `,
        { transaction }
      );
      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivablePayments"
          ADD CONSTRAINT "InventoryReceivablePayments_method_chk"
          CHECK ("paymentMethod" <> 'store_credit');
        `,
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("InventoryReceivablePayments");
  }
};
