/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    return sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "InventoryReceivables",
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
          customerId: {
            type: DataTypes.INTEGER,
            allowNull: false
          },
          saleId: {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          originType: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: "store_credit"
          },
          originalAmount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
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
          scheduleFrequency: {
            type: DataTypes.STRING(16),
            allowNull: true
          },
          installmentCount: {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          firstDueDate: {
            type: DataTypes.DATEONLY,
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
          CREATE UNIQUE INDEX IF NOT EXISTS "InventoryReceivables_id_companyId_unique"
          ON "InventoryReceivables" ("id", "companyId");
        `,
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivables"
          ADD CONSTRAINT "InventoryReceivables_customer_company_fk"
          FOREIGN KEY ("customerId", "companyId")
          REFERENCES "InventoryCustomers" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE RESTRICT;
        `,
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivables"
          ADD CONSTRAINT "InventoryReceivables_sale_company_fk"
          FOREIGN KEY ("saleId", "companyId")
          REFERENCES "InventorySales" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE SET NULL;
        `,
        { transaction }
      );

      await queryInterface.addIndex(
        "InventoryReceivables",
        ["companyId", "customerId", "status"],
        {
          name: "InventoryReceivables_company_customer_status_idx",
          transaction
        }
      );
      await queryInterface.addIndex(
        "InventoryReceivables",
        ["companyId", "saleId"],
        { name: "InventoryReceivables_company_sale_idx", transaction }
      );
      await queryInterface.addIndex(
        "InventoryReceivables",
        ["companyId", "status"],
        { name: "InventoryReceivables_company_status_idx", transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivables"
          ADD CONSTRAINT "InventoryReceivables_amounts_nonneg_chk"
          CHECK ("originalAmount" >= 0 AND "openAmount" >= 0);
        `,
        { transaction }
      );
      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivables"
          ADD CONSTRAINT "InventoryReceivables_status_chk"
          CHECK (status IN ('open', 'partial', 'paid', 'cancelled'));
        `,
        { transaction }
      );
      await sequelize.query(
        `
          ALTER TABLE "InventoryReceivables"
          ADD CONSTRAINT "InventoryReceivables_originType_chk"
          CHECK ("originType" IN ('store_credit'));
        `,
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("InventoryReceivables");
  }
};
