/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    return sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "InventoryReceivableInstallments",
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
          sequence: {
            type: DataTypes.INTEGER,
            allowNull: false
          },
          dueDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
          },
          originalAmount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
          },
          paidAmount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0
          },
          openAmount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
          },
          status: {
            type: DataTypes.STRING(16),
            allowNull: false,
            defaultValue: "open"
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
          CREATE UNIQUE INDEX IF NOT EXISTS "InventoryReceivableInstallments_id_companyId_unique"
          ON "InventoryReceivableInstallments" ("id", "companyId");
        `,
        { transaction }
      );

      // Âncora para FK composta payment → (installment, receivable, company).
      await sequelize.query(
        `
          CREATE UNIQUE INDEX IF NOT EXISTS "InventoryReceivableInstallments_id_recv_company_unique"
          ON "InventoryReceivableInstallments" ("id", "receivableId", "companyId");
        `,
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivableInstallments"
          ADD CONSTRAINT "InventoryReceivableInstallments_receivable_company_fk"
          FOREIGN KEY ("receivableId", "companyId")
          REFERENCES "InventoryReceivables" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE CASCADE;
        `,
        { transaction }
      );

      await queryInterface.addIndex(
        "InventoryReceivableInstallments",
        ["companyId", "receivableId", "sequence"],
        {
          name: "InventoryReceivableInstallments_company_recv_seq_uq",
          unique: true,
          transaction
        }
      );
      await queryInterface.addIndex(
        "InventoryReceivableInstallments",
        ["companyId", "dueDate", "status"],
        {
          name: "InventoryReceivableInstallments_company_due_status_idx",
          transaction
        }
      );
      await queryInterface.addIndex(
        "InventoryReceivableInstallments",
        ["companyId", "status"],
        {
          name: "InventoryReceivableInstallments_company_status_idx",
          transaction
        }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivableInstallments"
          ADD CONSTRAINT "InventoryReceivableInstallments_amounts_chk"
          CHECK (
            "originalAmount" > 0
            AND "paidAmount" >= 0
            AND "openAmount" >= 0
          );
        `,
        { transaction }
      );
      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivableInstallments"
          ADD CONSTRAINT "InventoryReceivableInstallments_status_chk"
          CHECK (status IN ('open', 'partial', 'paid', 'cancelled'));
        `,
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("InventoryReceivableInstallments");
  }
};
