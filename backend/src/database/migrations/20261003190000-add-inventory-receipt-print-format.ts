import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("InventorySettings", "receiptPrintFormat", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "a4"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn(
      "InventorySettings",
      "receiptPrintFormat"
    );
  }
};
