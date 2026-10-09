/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    return sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "InventorySales",
        "customerId",
        {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventorySales"
          ADD CONSTRAINT "InventorySales_customer_company_fk"
          FOREIGN KEY ("customerId", "companyId")
          REFERENCES "InventoryCustomers" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE SET NULL;
        `,
        { transaction }
      );

      await queryInterface.addIndex(
        "InventorySales",
        ["companyId", "customerId", "completedAt"],
        {
          name: "InventorySales_companyId_customerId_completedAt_idx",
          transaction
        }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;
    return sequelize.transaction(async transaction => {
      await sequelize.query(
        `
          ALTER TABLE "InventorySales"
          DROP CONSTRAINT IF EXISTS "InventorySales_customer_company_fk";
        `,
        { transaction }
      );
      try {
        await queryInterface.removeIndex(
          "InventorySales",
          "InventorySales_companyId_customerId_completedAt_idx",
          { transaction }
        );
      } catch {
        // ignore
      }
      await queryInterface.removeColumn("InventorySales", "customerId", {
        transaction
      });
    });
  }
};
