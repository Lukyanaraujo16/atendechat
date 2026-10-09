/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    return sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        "InventoryStoreCreditOverrides",
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
          receivableId: {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          overrideType: {
            type: DataTypes.STRING(32),
            allowNull: false
          },
          creditLimitAtMoment: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
          },
          creditUsedAtMoment: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
          },
          creditAvailableAtMoment: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
          },
          requestedAmount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
          },
          exceededAmount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0
          },
          overdueOpenAmountAtMoment: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0
          },
          reason: {
            type: DataTypes.TEXT,
            allowNull: true
          },
          authorizedByUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT"
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
          ALTER TABLE "InventoryStoreCreditOverrides"
          ADD CONSTRAINT "InventoryStoreCreditOverrides_customer_company_fk"
          FOREIGN KEY ("customerId", "companyId")
          REFERENCES "InventoryCustomers" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE RESTRICT;
        `,
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryStoreCreditOverrides"
          ADD CONSTRAINT "InventoryStoreCreditOverrides_sale_company_fk"
          FOREIGN KEY ("saleId", "companyId")
          REFERENCES "InventorySales" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE SET NULL;
        `,
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryStoreCreditOverrides"
          ADD CONSTRAINT "InventoryStoreCreditOverrides_receivable_company_fk"
          FOREIGN KEY ("receivableId", "companyId")
          REFERENCES "InventoryReceivables" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE SET NULL;
        `,
        { transaction }
      );

      await queryInterface.addIndex(
        "InventoryStoreCreditOverrides",
        ["companyId", "customerId", "createdAt"],
        {
          name: "InventoryStoreCreditOverrides_company_customer_created_idx",
          transaction
        }
      );
      await queryInterface.addIndex(
        "InventoryStoreCreditOverrides",
        ["companyId", "saleId"],
        {
          name: "InventoryStoreCreditOverrides_company_sale_idx",
          transaction
        }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryStoreCreditOverrides"
          ADD CONSTRAINT "InventoryStoreCreditOverrides_type_chk"
          CHECK ("overrideType" IN ('limit', 'overdue', 'limit_and_overdue'));
        `,
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("InventoryStoreCreditOverrides");
  }
};
